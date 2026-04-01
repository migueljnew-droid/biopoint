import { api } from './api';
import * as FileSystem from 'expo-file-system/legacy';

export interface AnalysisResult {
    summary: string;
    markers: Array<{
        name: string;
        value: number;
        unit: string;
        range: string;
        flag: 'HIGH' | 'LOW' | 'NORMAL';
        insight: string;
    }>;
}

export const labsService = {
    getPresignedUrl: async (filename: string, contentType: string) => {
        const response = await api.post('/labs/presign', { filename, contentType });
        return response.data;
    },

    uploadFile: async (uri: string, uploadUrl: string, contentType: string) => {
        try {
            const response = await FileSystem.uploadAsync(uploadUrl, uri, {
                httpMethod: 'PUT',
                uploadType: 1, // BINARY_CONTENT
                headers: {
                    'Content-Type': contentType,
                },
            });
            if (response.status >= 400) {
                throw new Error(`Upload failed with status ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    },

    createReport: async (data: { filename: string; s3Key: string; notes?: string }) => {
        const response = await api.post('/labs', data);
        return response.data;
    },

    getTrends: async () => {
        const response = await api.get('/labs/trends');
        return response.data;
    },

    analyzeReport: async (id: string, imageUri?: string, imageMimeType?: string): Promise<AnalysisResult> => {
        let body: any = {};
        if (imageUri) {
            const b64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
            body = { imageBase64: b64, imageMimeType: imageMimeType || 'image/jpeg' };
        }
        const response = await api.post(`/labs/${id}/analyze`, body);
        return response.data;
    },
};
