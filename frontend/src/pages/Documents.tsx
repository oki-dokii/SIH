import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  Search,
  Filter,
  ChevronDown,
  FileText,
  Eye,
  Trash2,
  Upload,
  Calendar,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function DocumentsPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const mockDocuments = [
    {
      id: 1,
      title: 'Highway Development Project - Phase 1',
      status: 'Completed',
      date: '2025-01-15',
      pages: 145,
      statusColor: 'text-green-600',
      statusBg: 'bg-green-50',
    },
    {
      id: 2,
      title: 'Bridge Construction Analysis Report',
      status: 'Completed',
      date: '2025-01-14',
      pages: 89,
      statusColor: 'text-green-600',
      statusBg: 'bg-green-50',
    },
    {
      id: 3,
      title: 'Urban Infrastructure Modernization',
      status: 'Processing',
      date: '2025-01-13',
      pages: 203,
      statusColor: 'text-blue-600',
      statusBg: 'bg-blue-50',
    },
    {
      id: 4,
      title: 'Water Supply System Enhancement',
      status: 'Completed',
      date: '2025-01-12',
      pages: 156,
      statusColor: 'text-green-600',
      statusBg: 'bg-green-50',
    },
  ]

  const stats = [
    { label: 'Total Documents', value: '24', change: '+12%', color: 'text-primary' },
    { label: 'Completed', value: '21', change: '+8%', color: 'text-green-600' },
    { label: 'Processing', value: '2', change: '0%', color: 'text-gray-500' },
    { label: 'Total Pages', value: '3.2K', change: '+15%', color: 'text-primary' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Documents</h1>
            <p className="text-muted-foreground">Manage and analyze your DPR documents</p>
          </div>
          <Button size="lg">
            <Upload className="h-4 w-4" />
            Upload New Document
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4" />
            All Documents
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            Upload Date
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                  {stat.change}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockDocuments.map((doc) => (
            <Card key={doc.id} className="p-6 hover:border-primary/40 transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1 line-clamp-2">{doc.title}</h3>
                  <div className={`inline-flex text-xs px-2 py-1 rounded-full ${doc.statusBg} ${doc.statusColor} font-medium`}>
                    {doc.status}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {doc.date}
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {doc.pages} pages
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => navigate(`/document/${doc.id}`)}
                >
                  <Eye className="h-4 w-4" />
                  View Analysis
                </Button>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
