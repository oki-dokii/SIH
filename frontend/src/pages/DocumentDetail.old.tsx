import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  ArrowLeft,
  Share2,
  Download,
  DollarSign,
  Clock,
  MapPin,
  Users,
  TrendingUp,
  MessageSquare,
  Send,
  FileText,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function DocumentDetailPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; text: string }>>([
    {
      role: 'assistant',
      text: "Hello! I'm your DPR analysis assistant. Ask me anything about the uploaded document.",
    },
  ])

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'timeline', label: 'Timeline' },
  ]

  const overview = {
    title: 'Highway Development Project - Phase 1',
    uploadDate: '2025-01-15',
    pages: 145,
    projectCost: '$45.2M',
    duration: '24 months',
    location: 'Northeast Region',
    startDate: 'March 2025',
    teamSize: '12 Members',
    progress: '35%',
  }

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return
    
    setChatHistory([...chatHistory, { role: 'user', text: chatMessage }])
    setChatMessage('')
    
    setTimeout(() => {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'This is a sample response from the AI assistant. In the actual implementation, this would query the Gemini API with the document context.',
        },
      ])
    }, 1000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{overview.title}</h1>
            <p className="text-muted-foreground">
              Uploaded on {overview.uploadDate} · {overview.pages} pages
            </p>
          </div>
          <Button variant="outline">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Project Cost
            </div>
            <div className="text-xl font-bold">{overview.projectCost}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              Duration
            </div>
            <div className="text-xl font-bold">{overview.duration}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <MapPin className="h-4 w-4" />
              Location
            </div>
            <div className="text-xl font-bold">{overview.location}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              Start Date
            </div>
            <div className="text-xl font-bold">{overview.startDate}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Team Size
            </div>
            <div className="text-xl font-bold">{overview.teamSize}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Progress
            </div>
            <div className="text-xl font-bold">{overview.progress}</div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <div className="border-b">
                <div className="flex">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'px-6 py-3 font-medium transition-colors',
                        activeTab === tab.id
                          ? 'text-primary border-b-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Project Overview
                      </h3>
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Project Description</h4>
                        <p className="text-muted-foreground">
                          This comprehensive highway development project aims to modernize and expand the
                          transportation infrastructure in the Northeast region. The project includes road
                          widening, bridge construction, and installation of modern traffic management
                          systems.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Key Objectives</h4>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1">
                          <li>Reduce travel time by 40%</li>
                          <li>Improve road safety standards</li>
                          <li>Enhance regional connectivity</li>
                          <li>Create sustainable infrastructure</li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Project Progress</h4>
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-primary h-3 rounded-full"
                          style={{ width: '35%' }}
                        ></div>
                      </div>
                      <p className="text-sm text-muted-foreground">35% Complete</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Budget Breakdown</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Construction</span>
                            <span className="text-sm font-medium">$28M</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: '62%' }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Materials</span>
                            <span className="text-sm font-medium">$10M</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: '22%' }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Equipment</span>
                            <span className="text-sm font-medium">$5M</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: '11%' }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Contingency</span>
                            <span className="text-sm font-medium">$2.2M</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: '5%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <div className="border-b p-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg',
                      msg.role === 'user'
                        ? 'bg-primary text-white ml-8'
                        : 'bg-muted mr-8'
                    )}
                  >
                    <p className="text-sm">{msg.text}</p>
                  </div>
                ))}
              </div>

              <div className="border-t p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about the document..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
