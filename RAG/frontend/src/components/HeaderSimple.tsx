import { FileText } from 'lucide-react'

export function HeaderSimple() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                        <FileText className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-primary">Offline PDF Chat</span>
                </div>

                <div className="text-sm text-muted-foreground">
                    Powered by RAG Engine
                </div>
            </div>
        </header>
    )
}
