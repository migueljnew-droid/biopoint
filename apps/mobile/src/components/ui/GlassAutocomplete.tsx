import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Keyboard } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { GlassView } from './GlassView';

const SUGGESTIONS = [
    // --- PEPTIDES ---
    // GLP-1 & Weight Loss
    'Retatrutide', 'Tirzepatide', 'Semaglutide', 'Liraglutide', 'Dulaglutide', 'AOD-9604', '5-Amino-1MQ', 'Tesofensine',
    // Healing & Repair
    'BPC-157', 'TB-500 (Thymosin Beta-4)', 'GHK-Cu', 'KPV', 'LL-37',
    // GH Secretagogues
    'Ipamorelin', 'CJC-1295 (No DAC)', 'CJC-1295 (DAC)', 'Tesamorelin', 'Sermorelin', 'MK-677 (Ibutamoren)', 'GHRP-2', 'GHRP-6', 'Hexarelin',
    // Bioregulators & Longevity
    'Epitalon', 'Thymalin', 'Thymosin Alpha-1', 'MOTS-c', 'Humanin', 'SS-31', 'Foxo4-DRI',
    // Cognitive (Nootropic Peptides)
    'Semax', 'N-Acetyl Semax', 'Selank', 'N-Acetyl Selank', 'Cerebrolysin', 'Cortagen', 'Pinealon', 'Dihexa',
    // Sexual Health & Tanning
    'PT-141 (Bremelanotide)', 'Melanotan II', 'Kisspeptin-10',

    // --- VITAMINS & MINERALS ---
    'Vitamin D3', 'Vitamin K2 (MK-7)', 'Vitamin B12 (Methylcobalamin)', 'Vitamin B Complex', 'Vitamin C (Liposomal)', 'Vitamin A (Retinol)', 'Vitamin E (Tocotrienols)',
    'Magnesium Glycinate', 'Magnesium Threonate', 'Magnesium Malate', 'Magnesium Citrate',
    'Zinc Picolinate', 'Zinc Carnosine', 'Selenium', 'Iodine (Lugols)', 'Iron Bisglycinate', 'Copper Bisglycinate', 'Boron', 'Chromium Picolinate',

    // --- LONGEVITY & MITOCHONDRIA ---
    'NMN (Nicotinamide Mononucleotide)', 'NR (Nicotinamide Riboside)', 'Resveratrol', 'Pterostilbene', 'Rapamycin', 'Metformin', 'Berberine', 'Spermidine', 'Fisetin', 'Quercetin', 'Apigenin', 'CoQ10 (Ubiquinol)', 'PQQ', 'Methylene Blue', 'Urolithin A', 'Ca-AKG',

    // --- NOOTROPICS & ADAPTOGENS ---
    'Ashwagandha (KSM-66)', 'Rhodiola Rosea', 'Lions Mane Mushroom', 'Cordyceps', 'Reishi Mushroom', 'Bacopa Monnieri', 'Ginkgo Biloba', 'Panax Ginseng', 'Saffron Extract',
    'Alpha-GPC', 'CDP-Choline (Citicoline)', 'Huperzine A', 'Phosphatidylserine', 'L-Theanine', 'Caffeine', 'Dynamine', 'Teacrine', 'Modafinil', 'Armodafinil', 'Phenylpiracetam', 'Aniracetam', 'Noopept', 'Bromantane',

    // --- AMINO ACIDS & PERFORMANCE ---
    'Creatine Monohydrate', 'L-Glutamine', 'Taurine', 'L-Arginine', 'L-Citrulline', 'Beta-Alanine', 'L-Carnitine', 'Acetyl-L-Carnitine (ALCAR)', 'L-Tyrosine', 'N-Acetyl L-Tyrosine (NALT)', 'L-Tryptophan', '5-HTP', 'NAC (N-Acetyl Cysteine)', 'Glycine', 'HMB',

    // --- HORMONES & PCT (Biohacking) ---
    'Testosterone Cypionate', 'Testosterone Enanthate', 'Testosterone Propionate', 'HCG', 'Enclomiphene', 'Clomid', 'Anastrazole', 'Aromasin', 'Proviron', 'Primobolan', 'Anavar (Oxandrolone)', 'Tongkat Ali', 'Fadogia Agrestis', 'Turkesterone', 'Ecdysterone', 'DHEA', 'Pregnenolone'
].sort();

interface GlassAutocompleteProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    label?: string;
}

export function GlassAutocomplete({ value, onChangeText, placeholder, label }: GlassAutocompleteProps) {
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (value.length > 0 && isFocused) {
            const filtered = SUGGESTIONS.filter(item =>
                item.toLowerCase().includes(value.toLowerCase()) && item !== value
            );
            setFilteredSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
            setShowSuggestions(filtered.length > 0);
        } else {
            setShowSuggestions(false);
        }
    }, [value, isFocused]);

    const handleSelect = (item: string) => {
        onChangeText(item);
        setShowSuggestions(false);
        Keyboard.dismiss();
    };

    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>}
            <GlassView variant={isFocused ? 'selected' : 'light'} intensity={20} borderRadius={borderRadius.lg}>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        // Small delay to allow press on suggestion to register
                        setTimeout(() => setIsFocused(false), 200);
                    }}
                />
            </GlassView>

            {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                    <GlassView variant="heavy" borderRadius={borderRadius.md} style={styles.suggestionsGlass}>
                        {filteredSuggestions.map((item, index) => (
                            <Pressable
                                key={index}
                                style={({ pressed }) => [styles.suggestionItem, pressed && styles.suggestionPressed]}
                                onPress={() => handleSelect(item)}
                            >
                                <Text style={styles.suggestionText}>{item}</Text>
                            </Pressable>
                        ))}
                    </GlassView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
        zIndex: 10, // Ensure suggestions float above other content
    },
    label: {
        ...typography.label,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginLeft: 4,
    },
    labelFocused: {
        color: colors.primary,
    },
    input: {
        padding: spacing.md,
        color: colors.textPrimary,
        ...typography.body,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        zIndex: 20,
    },
    suggestionsGlass: {
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },
    suggestionPressed: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    suggestionText: {
        ...typography.body,
        color: colors.textPrimary,
    },
});
