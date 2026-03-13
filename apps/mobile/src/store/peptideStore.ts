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
    search: (query: string) => Peptide[];
    filterByCategory: (category: string | null) => Peptide[];
    filterByGoal: (goal: string | null) => Peptide[];
    filterByCategoryAndGoal: (category: string | null, goal: string | null) => Peptide[];
    getById: (id: string) => Peptide | undefined;
}

// ---------------------------------------------------------------------------
// Pre-computed indexes (built once at module load — PERF-003, PERF-007)
// ---------------------------------------------------------------------------

const allCompounds = peptideDatabase as Peptide[];

const searchIndex = allCompounds.map((p) => ({
    compound: p,
    searchText: [p.name, ...p.aliases, p.category, p.description]
        .join(' ')
        .toLowerCase(),
}));

const compoundById = new Map(allCompounds.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePeptideStore = create<PeptideState>(() => ({
    compounds: allCompounds,
    isLoading: false,

    search: (query: string): Peptide[] => {
        const q = query.trim().toLowerCase();
        if (!q) return allCompounds;
        return searchIndex
            .filter((entry) => entry.searchText.includes(q))
            .map((entry) => entry.compound);
    },

    filterByCategory: (category: string | null): Peptide[] => {
        if (!category) return allCompounds;
        const cat = category.toLowerCase();
        return allCompounds.filter((p) => p.category.toLowerCase() === cat);
    },

    filterByGoal: (goal: string | null): Peptide[] => {
        if (!goal) return allCompounds;
        const g = goal.toLowerCase();
        return allCompounds.filter((p) =>
            p.goals.some((pg) => pg.toLowerCase().includes(g))
        );
    },

    filterByCategoryAndGoal: (category: string | null, goal: string | null): Peptide[] => {
        let results = allCompounds;
        if (category) {
            const cat = category.toLowerCase();
            results = results.filter((p) => p.category.toLowerCase() === cat);
        }
        if (goal) {
            const g = goal.toLowerCase();
            results = results.filter((p) =>
                p.goals.some((pg) => pg.toLowerCase().includes(g))
            );
        }
        return results;
    },

    getById: (id: string): Peptide | undefined => {
        return compoundById.get(id);
    },
}));
