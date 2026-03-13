import { create } from 'zustand';
import peptideDatabase from '../data/peptideDatabase.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PeptideCitation {
    title: string;
    url: string;
    year: number;
}

export interface PeptideTypicalDose {
    min: number;
    max: number;
    unit: string;
}

export interface Peptide {
    id: string;
    name: string;
    aliases: string[];
    category: string;
    goals: string[];
    typicalDose: PeptideTypicalDose;
    halfLife: string;
    route: string;
    frequency: string;
    cycleProtocol: string;
    stackingNotes: string;
    citations: PeptideCitation[];
    iuConversion: number | null;
    description: string;
}

interface PeptideState {
    compounds: Peptide[];
    isLoading: boolean;
    // Actions
    search: (query: string) => Peptide[];
    filterByCategory: (category: string | null) => Peptide[];
    filterByGoal: (goal: string | null) => Peptide[];
    filterByCategoryAndGoal: (category: string | null, goal: string | null) => Peptide[];
    getById: (id: string) => Peptide | undefined;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePeptideStore = create<PeptideState>(() => ({
    compounds: peptideDatabase as Peptide[],
    isLoading: false,

    search: (query: string): Peptide[] => {
        const q = query.trim().toLowerCase();
        if (!q) return peptideDatabase as Peptide[];
        return (peptideDatabase as Peptide[]).filter((p) => {
            if (p.name.toLowerCase().includes(q)) return true;
            if (p.aliases.some((a) => a.toLowerCase().includes(q))) return true;
            if (p.description.toLowerCase().includes(q)) return true;
            if (p.category.toLowerCase().includes(q)) return true;
            return false;
        });
    },

    filterByCategory: (category: string | null): Peptide[] => {
        if (!category) return peptideDatabase as Peptide[];
        return (peptideDatabase as Peptide[]).filter(
            (p) => p.category.toLowerCase() === category.toLowerCase()
        );
    },

    filterByGoal: (goal: string | null): Peptide[] => {
        if (!goal) return peptideDatabase as Peptide[];
        return (peptideDatabase as Peptide[]).filter((p) =>
            p.goals.some((g) => g.toLowerCase().includes(goal.toLowerCase()))
        );
    },

    filterByCategoryAndGoal: (category: string | null, goal: string | null): Peptide[] => {
        let results = peptideDatabase as Peptide[];
        if (category) {
            results = results.filter(
                (p) => p.category.toLowerCase() === category.toLowerCase()
            );
        }
        if (goal) {
            results = results.filter((p) =>
                p.goals.some((g) => g.toLowerCase().includes(goal.toLowerCase()))
            );
        }
        return results;
    },

    getById: (id: string): Peptide | undefined => {
        return (peptideDatabase as Peptide[]).find((p) => p.id === id);
    },
}));
