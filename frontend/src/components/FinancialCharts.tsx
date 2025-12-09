import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card } from './ui/Card'
import { DollarSign } from 'lucide-react'
import { formatIndianCurrency, formatChartCurrency } from '@/lib/currency'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658']

interface FinancialChartsProps {
  data: any
}

export function FinancialCharts({ data }: FinancialChartsProps) {
  const financialAnalysis = data?.financialAnalysis

  if (!financialAnalysis) {
    return null
  }

  const projectCost = financialAnalysis.projectCost
  const capitalStructure = financialAnalysis.capitalStructure
  const costBreakdown = financialAnalysis.costBreakdown || []

  const safeNumber = (val: any): number => {
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }



  const projectCostData = []
  if (projectCost?.capitalExpenditureLakhINR) {
    const value = safeNumber(projectCost.capitalExpenditureLakhINR)
    if (value > 0) projectCostData.push({ name: 'Capital Expenditure', value })
  }
  if (projectCost?.workingCapitalLakhINR) {
    const value = safeNumber(projectCost.workingCapitalLakhINR)
    if (value > 0) projectCostData.push({ name: 'Working Capital', value })
  }
  if (projectCost?.culturalCostLakhINR) {
    const value = safeNumber(projectCost.culturalCostLakhINR)
    if (value > 0) projectCostData.push({ name: 'Cultural Cost', value })
  }
  if (projectCost?.contingencyLakhINR) {
    const value = safeNumber(projectCost.contingencyLakhINR)
    if (value > 0) projectCostData.push({ name: 'Contingency', value })
  }
  if (projectCost?.marginMoneyLakhINR) {
    const value = safeNumber(projectCost.marginMoneyLakhINR)
    if (value > 0) projectCostData.push({ name: 'Margin Money', value })
  }

  const capitalStructureData = []
  if (capitalStructure?.ncdcLoanLakhINR) {
    const value = safeNumber(capitalStructure.ncdcLoanLakhINR)
    if (value > 0) capitalStructureData.push({ name: 'NCDC Loan', value })
  }
  if (capitalStructure?.subsidyLakhINR) {
    const value = safeNumber(capitalStructure.subsidyLakhINR)
    if (value > 0) capitalStructureData.push({ name: 'Subsidy', value })
  }
  if (capitalStructure?.subsidyMIDH_NHB_LakhINR) {
    const value = safeNumber(capitalStructure.subsidyMIDH_NHB_LakhINR)
    if (value > 0) capitalStructureData.push({ name: 'MIDH/NHB Subsidy', value })
  }
  if (capitalStructure?.equityOrOwnContributionLakhINR) {
    const value = safeNumber(capitalStructure.equityOrOwnContributionLakhINR)
    if (value > 0) capitalStructureData.push({ name: 'Equity/Own Contribution', value })
  }
  if (capitalStructure?.loanLakhINR) {
    const value = safeNumber(capitalStructure.loanLakhINR)
    if (value > 0) capitalStructureData.push({ name: 'Loan', value })
  }
  if (capitalStructure?.memberContributionLakhINR) {
    const value = safeNumber(capitalStructure.memberContributionLakhINR)
    if (value > 0) capitalStructureData.push({ name: 'Member Contribution', value })
  }

  // Filter out items with zero or invalid amounts for cost breakdown table
  const validCostBreakdown = costBreakdown.filter((item: any) => {
    const amount = safeNumber(item.amountLakhINR)
    return amount > 0 && item.component
  })

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180)
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180)

    if (percent < 0.05) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && payload[0]?.value !== undefined) {
      const value = safeNumber(payload[0].value)
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{payload[0].name}</p>
          <p className="text-primary font-bold">{formatIndianCurrency(value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Cost Breakdown Table - NEW */}
      {validCostBreakdown.length > 0 && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-indigo-600" />
            Cost Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-indigo-200 dark:border-indigo-800">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Component</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Amount (₹ Lakh)</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {validCostBreakdown.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/50 transition-colors">
                    <td className="py-3 px-2">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{item.component}</span>
                    </td>
                    <td className="text-right py-3 px-2 font-semibold text-gray-900 dark:text-gray-100">
                      {formatChartCurrency(safeNumber(item.amountLakhINR))}
                    </td>
                    <td className="text-right py-3 px-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                      {safeNumber(item.percent) > 0 ? `${safeNumber(item.percent).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950">
                  <td className="py-3 px-2 font-bold text-gray-800 dark:text-gray-200">Total</td>
                  <td className="text-right py-3 px-2 font-bold text-gray-900 dark:text-gray-100">
                    {formatChartCurrency(validCostBreakdown.reduce((sum: number, item: any) => sum + safeNumber(item.amountLakhINR), 0))}
                  </td>
                  <td className="text-right py-3 px-2 font-bold text-indigo-600 dark:text-indigo-400">
                    {validCostBreakdown.reduce((sum: number, item: any) => sum + safeNumber(item.percent), 0).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Original Pie Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {projectCostData.length > 0 && (
          <Card className="p-6">
            <h4 className="font-semibold mb-4 text-center">Project Cost Breakdown</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={projectCostData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {projectCostData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {projectCost?.totalInitialInvestmentLakhINR && (
              <div className="mt-4 text-center p-3 bg-primary/10 rounded">
                <p className="text-sm text-muted-foreground">Total Investment</p>
                <p className="text-2xl font-bold text-primary">
                  {formatIndianCurrency(safeNumber(projectCost.totalInitialInvestmentLakhINR))}
                </p>
              </div>
            )}
          </Card>
        )}

        {capitalStructureData.length > 0 && (
          <Card className="p-6">
            <h4 className="font-semibold mb-4 text-center">Capital Structure Breakdown</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={capitalStructureData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {capitalStructureData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {capitalStructure?.termLoanInterestRatePercent && (
              <div className="mt-4 text-center p-3 bg-accent/10 rounded">
                <p className="text-sm text-muted-foreground">Term Loan Interest Rate</p>
                <p className="text-xl font-bold text-accent">
                  {safeNumber(capitalStructure.termLoanInterestRatePercent).toFixed(2)}%
                </p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Original Bar Chart */}
      {(projectCostData.length > 0 || capitalStructureData.length > 0) && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Cost Components Comparison</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[...projectCostData, ...capitalStructureData]}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                style={{ fontSize: '11px' }}
              />
              <YAxis
                label={{ value: 'Amount (₹ Lakh)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
