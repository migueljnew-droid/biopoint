import { api } from './api';

export interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
    trend: string;
    avatar: string;
    elite: boolean;
    isUser?: boolean;
}

export const communityService = {
    getLeaderboard: async (): Promise<LeaderboardEntry[]> => {
        const response = await api.get('/community/leaderboard');
        return response.data;
    },

    joinGroup: async (groupId: string): Promise<void> => {
        await api.post(`/community/groups/${groupId}/join`);
    },

    leaveGroup: async (groupId: string): Promise<void> => {
        await api.post(`/community/groups/${groupId}/leave`);
    },
};
