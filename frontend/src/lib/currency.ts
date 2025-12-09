/**
 * Format currency in Indian numbering system
 * - Values >= 100 lakhs are shown in crores (e.g., 223L → 2.23 Cr)
 * - Values < 100 lakhs are shown in lakhs (e.g., 20L → 20 L or 20.50 L)
 */
export function formatIndianCurrency(lakhValue: number): string {
    if (lakhValue >= 100) {
        const crores = lakhValue / 100
        return `₹${crores.toFixed(2)} Cr`
    }

    // For values less than 100 lakhs
    // Show without decimals if it's a whole number, otherwise show 2 decimals
    if (Number.isInteger(lakhValue)) {
        return `₹${lakhValue} L`
    }
    return `₹${lakhValue.toFixed(2)} L`
}

/**
 * Format currency for chart labels (shorter format)
 */
export function formatChartCurrency(lakhValue: number): string {
    if (lakhValue >= 100) {
        const crores = lakhValue / 100
        return `₹${crores.toFixed(0)}Cr`
    }

    if (lakhValue >= 10) {
        return `₹${lakhValue.toFixed(0)}L`
    }
    return `₹${lakhValue.toFixed(2)}L`
}
