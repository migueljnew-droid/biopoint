import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, spacing, borderRadius } from '../theme';


interface ScoreChartProps {
    data: number[];
    labels?: string[];
}

export const ScoreChart = ({ data, labels }: ScoreChartProps) => {
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - (spacing.lg * 2) - (spacing.lg * 2); // Screen padding - Card padding

    // Ensure we have data, otherwise show a placeholder or empty chart
    const chartData = {
        labels: labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                data: data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0],
                color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`, // Primary color
                strokeWidth: 3,
            },
        ],
    };

    const chartConfig = {
        backgroundGradientFrom: '#fff',
        backgroundGradientFromOpacity: 0,
        backgroundGradientTo: '#fff',
        backgroundGradientToOpacity: 0,
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
        decimalPlaces: 0,
        propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: colors.primary,
            fill: colors.background,
        },
        propsForBackgroundLines: {
            strokeWidth: 1,
            stroke: 'rgba(255, 255, 255, 0.1)',
            strokeDasharray: '0',
        },
        propsForLabels: {
            fontSize: 10,
            fill: colors.textSecondary,
        }
    };

    return (
        <View style={styles.container}>
            <LineChart
                data={chartData}
                width={chartWidth}
                height={180}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withDots={true}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLines={true}
                withHorizontalLabels={true}
                withVerticalLabels={true}
                yAxisInterval={1}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.sm,
    },
    chart: {
        borderRadius: borderRadius.lg,
        paddingRight: 40, // Adjust for labels
    },
});
