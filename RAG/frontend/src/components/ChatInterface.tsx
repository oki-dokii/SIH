import { Send, Loader2 } from 'lucide-react'
import { Button } from './ui/Button'
import { useState, useRef, useEffect } from 'react'
import { ChatMessageFormatter } from './ChatMessageFormatter'

interface Message {
    id: number
    role: 'user' | 'assistant'
    text: string
    timestamp: string
}

interface ChatInterfaceProps {
    messages: Message[]
    onSendMessage: (message: string) => Promise<void>
    isLoading?: boolean
}

export function ChatInterface({ messages, onSendMessage, isLoading = false }: ChatInterfaceProps) {
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const message = input.trim()
        setInput('')

        try {
            await onSendMessage(message)
        } catch (error) {
            console.error('Failed to send message:', error)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center">
                        <div className="space-y-2">
                            <p className="text-lg text-muted-foreground">No messages yet</p>
                            <p className="text-sm text-muted-foreground">Start a conversation by asking a question about your PDF</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-4 ${message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-card border border-border'
                                        }`}
                                >
                                    {message.role === 'assistant' ? (
                                        <ChatMessageFormatter text={message.text} isUser={false} />
                                    ) : (
                                        <p className="whitespace-pre-wrap">{message.text}</p>
                                    )}
                                    <p className="text-xs opacity-70 mt-2">
                                        {new Date(message.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-lg p-4 bg-card border border-border">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <p className="text-muted-foreground">Thinking...</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            <div className="border-t p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question about your PDF..."
                        className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={isLoading}
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()}>
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
