import type { UploadFileResponse } from '@/types/api'

export type FileAttachment = {
    id: string
    file: File
    status: 'uploading' | 'complete' | 'error'
    path?: string
    error?: string
}

export type UploadFunction = (file: File) => Promise<UploadFileResponse>

function createFileAttachmentId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createFileAttachment(file: File): FileAttachment {
    return {
        id: createFileAttachmentId(),
        file,
        status: 'uploading'
    }
}

export function isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/')
}
