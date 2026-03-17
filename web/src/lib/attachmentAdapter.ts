import type { AttachmentAdapter, PendingAttachment, CompleteAttachment, Attachment } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import type { AttachmentMetadata } from '@/types/api'
import { isImageMimeType } from '@/lib/fileAttachments'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024
const MAX_STABLE_IMAGE_UPLOAD_BYTES = 512 * 1024
const MAX_COMPRESSED_IMAGE_EDGE = 1280
const MIN_COMPRESSED_IMAGE_SCALE = 0.1
const PREVIEW_TIMEOUT_MS = 1500
const PREVIEWABLE_IMAGE_MIME_TYPES = new Set([
    'image/avif',
    'image/bmp',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/webp'
])
const COMPRESSIBLE_IMAGE_EXTENSIONS = [
    '.avif',
    '.bmp',
    '.heic',
    '.heif',
    '.jpeg',
    '.jpg',
    '.png',
    '.webp'
]
const JPEG_QUALITY_STEPS = [0.78, 0.68, 0.58, 0.48, 0.38, 0.28, 0.18]

function createAttachmentId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function shouldGeneratePreview(file: File, contentType: string): boolean {
    if (!isImageMimeType(contentType) || file.size > MAX_PREVIEW_BYTES) {
        return false
    }

    if (PREVIEWABLE_IMAGE_MIME_TYPES.has(contentType.toLowerCase())) {
        return true
    }

    const filename = file.name.toLowerCase()
    return (
        filename.endsWith('.jpg')
        || filename.endsWith('.jpeg')
        || filename.endsWith('.png')
        || filename.endsWith('.gif')
        || filename.endsWith('.webp')
        || filename.endsWith('.bmp')
        || filename.endsWith('.svg')
        || filename.endsWith('.avif')
    )
}

function shouldCompressImage(file: File, contentType: string): boolean {
    if (file.size <= MAX_STABLE_IMAGE_UPLOAD_BYTES) {
        return false
    }

    const normalizedType = contentType.toLowerCase()
    if (normalizedType === 'image/gif' || normalizedType === 'image/svg+xml') {
        return false
    }

    if (isImageMimeType(normalizedType)) {
        return true
    }

    const filename = file.name.toLowerCase()
    return COMPRESSIBLE_IMAGE_EXTENSIONS.some((extension) => filename.endsWith(extension))
}

type PendingUploadAttachment = PendingAttachment & {
    errorMessage?: string
    path?: string
    previewUrl?: string
}

function createFailedAttachment(attachment: PendingUploadAttachment): PendingUploadAttachment {
    return attachment
}

function createPreviewAttachment(attachment: PendingUploadAttachment): PendingUploadAttachment {
    return attachment
}

export function createAttachmentAdapter(api: ApiClient, sessionId: string): AttachmentAdapter {
    const cancelledAttachmentIds = new Set<string>()

    const deleteUpload = async (path?: string) => {
        if (!path) return
        try {
            await api.deleteUploadFile(sessionId, path)
        } catch {
            // Best effort cleanup
        }
    }

    return {
        accept: '*/*',

        async *add({ file }): AsyncGenerator<PendingAttachment> {
            const id = createAttachmentId()
            let uploadFile = file
            let contentType = file.type || 'application/octet-stream'

            yield {
                id,
                type: 'file',
                name: file.name,
                contentType,
                file,
                status: { type: 'running', reason: 'uploading', progress: 0 }
            }

            try {
                if (cancelledAttachmentIds.has(id)) {
                    return
                }

                if (file.size > MAX_UPLOAD_BYTES) {
                    yield createFailedAttachment({
                        id,
                        type: 'file',
                        name: file.name,
                        contentType,
                        file,
                        status: { type: 'incomplete', reason: 'error' },
                        errorMessage: `File too large (${Math.round(file.size / (1024 * 1024))}MB > 50MB)`
                    })
                    return
                }

                if (shouldCompressImage(file, contentType)) {
                    const compressed = await compressImageForUpload(file)
                    uploadFile = compressed
                    contentType = compressed.type || 'image/jpeg'
                }

                if (shouldCompressImage(uploadFile, contentType) && uploadFile.size > MAX_STABLE_IMAGE_UPLOAD_BYTES) {
                    yield createFailedAttachment({
                        id,
                        type: 'file',
                        name: uploadFile.name,
                        contentType,
                        file: uploadFile,
                        status: { type: 'incomplete', reason: 'error' },
                        errorMessage: `Image is still too large after optimization (${Math.round(uploadFile.size / 1024)}KB > ${Math.round(MAX_STABLE_IMAGE_UPLOAD_BYTES / 1024)}KB)`
                    })
                    return
                }

                const content = await fileToBase64(uploadFile)
                if (cancelledAttachmentIds.has(id)) {
                    return
                }

                yield {
                    id,
                    type: 'file',
                    name: file.name,
                    contentType,
                    file,
                    status: { type: 'running', reason: 'uploading', progress: 50 }
                }

                const result = await api.uploadFile(sessionId, uploadFile.name, content, contentType)
                if (cancelledAttachmentIds.has(id)) {
                    if (result.success && result.path) {
                        await deleteUpload(result.path)
                    }
                    return
                }

                if (!result.success || !result.path) {
                    yield createFailedAttachment({
                        id,
                        type: 'file',
                        name: uploadFile.name,
                        contentType,
                        file: uploadFile,
                        status: { type: 'incomplete', reason: 'error' },
                        errorMessage: result.error || 'Upload failed'
                    })
                    return
                }

                const pendingAttachment: PendingUploadAttachment = {
                    id,
                    type: 'file',
                    name: uploadFile.name,
                    contentType,
                    file: uploadFile,
                    status: { type: 'requires-action', reason: 'composer-send' },
                    path: result.path
                }

                yield pendingAttachment

                if (!shouldGeneratePreview(uploadFile, contentType)) {
                    return
                }

                try {
                    const previewUrl = await withTimeout(fileToDataUrl(uploadFile), PREVIEW_TIMEOUT_MS)
                    if (!previewUrl || cancelledAttachmentIds.has(id)) {
                        return
                    }

                    yield createPreviewAttachment({
                        ...pendingAttachment,
                        previewUrl
                    })
                } catch {
                    // Preview generation is optional and should never block sending.
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Upload failed'
                console.error('[hapi] attachment upload failed', {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type || 'application/octet-stream',
                    error
                })
                yield createFailedAttachment({
                    id,
                    type: 'file',
                    name: uploadFile.name,
                    contentType,
                    file: uploadFile,
                    status: { type: 'incomplete', reason: 'error' },
                    errorMessage: message
                })
            }
        },

        async remove(attachment: Attachment): Promise<void> {
            cancelledAttachmentIds.add(attachment.id)
            const path = (attachment as PendingUploadAttachment).path
            await deleteUpload(path)
        },

        async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
            const pending = attachment as PendingUploadAttachment
            const path = pending.path

            // Build AttachmentMetadata to be sent with the message
            const metadata: AttachmentMetadata | undefined = path ? {
                id: attachment.id,
                filename: attachment.name,
                mimeType: attachment.contentType ?? 'application/octet-stream',
                size: attachment.file?.size ?? 0,
                path,
                previewUrl: pending.previewUrl
            } : undefined

            return {
                id: attachment.id,
                type: attachment.type,
                name: attachment.name,
                contentType: attachment.contentType,
                status: { type: 'complete' },
                // Store metadata as JSON in the text content for extraction by assistant-runtime
                content: metadata ? [{ type: 'text', text: JSON.stringify({ __attachmentMetadata: metadata }) }] : []
            }
        }
    }
}

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(',')[1]
            if (!base64) {
                reject(new Error('Failed to read file'))
                return
            }
            resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve(reader.result as string)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

async function compressImageForUpload(file: File): Promise<File> {
    const image = await loadImageFromFile(file)
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight)
    let scale = longestEdge > 0
        ? Math.min(1, MAX_COMPRESSED_IMAGE_EDGE / longestEdge)
        : 1
    let bestBlob: Blob | null = null

    while (scale >= MIN_COMPRESSED_IMAGE_SCALE) {
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            break
        }

        // Fill with white before JPEG export so transparent PNGs remain readable.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

        for (const quality of JPEG_QUALITY_STEPS) {
            const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
            if (!blob) {
                continue
            }

            bestBlob = blob
            if (blob.size <= MAX_STABLE_IMAGE_UPLOAD_BYTES) {
                return createCompressedFile(file, blob)
            }
        }

        scale *= 0.8
    }

    if (bestBlob) {
        return createCompressedFile(file, bestBlob)
    }

    return file
}

function createCompressedFile(originalFile: File, blob: Blob): File {
    const baseName = originalFile.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: originalFile.lastModified
    })
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file)
        const image = new Image()
        image.onload = () => {
            URL.revokeObjectURL(objectUrl)
            resolve(image)
        }
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error(`Failed to decode image: ${file.name}`))
        }
        image.src = objectUrl
    })
}

async function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number
): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality)
    })
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            reject(new Error(`Timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        promise
            .then((value) => {
                window.clearTimeout(timer)
                resolve(value)
            })
            .catch((error) => {
                window.clearTimeout(timer)
                reject(error)
            })
    })
}
