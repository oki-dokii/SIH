import React from 'react'

interface ChatMessageFormatterProps {
  text: string
  isUser: boolean
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

const renderInline = (text: string): React.ReactNode => {
  // Handle bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Handle italic
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>')
  // Handle inline code
  text = text.replace(/`(.*?)`/g, '<code class="bg-gray-800 text-yellow-300 px-2 py-0.5 rounded text-xs font-mono">$1</code>')

  return (
    <span dangerouslySetInnerHTML={{ __html: text }} className="break-words" />
  )
}

export function ChatMessageFormatter({ text, isUser }: ChatMessageFormatterProps) {
  const parseContent = (): React.ReactNode[] => {
    const sections: React.ReactNode[] = []
    const blocks = text.split('\n\n').filter(b => b.trim())

    blocks.forEach((block, blockIdx) => {
      const lines = block.split('\n')

      // Check for table (lines with |)
      if (lines.some(l => l.includes('|'))) {
        const tableLines = lines.filter(l => l.includes('|')).map(l => l.split('|').filter(c => c.trim()).map(c => c.trim()))
        if (tableLines.length >= 1) {
          sections.push(
            <div key={`table-${blockIdx}`} className="overflow-x-auto my-2">
              <table className="w-full text-xs border-collapse border border-gray-400 dark:border-gray-600">
                <tbody>
                  {tableLines.map((row, rowIdx) => (
                    <tr key={rowIdx} className={rowIdx === 0 ? 'bg-primary/20' : rowIdx % 2 ? 'bg-gray-50 dark:bg-gray-900' : ''}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">
                          {rowIdx === 0 ? <strong>{renderInline(cell)}</strong> : renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          return
        }
      }

      // Check for bullet list
      if (lines.some(l => l.match(/^[\s]*[-•*]\s/))) {
        const items = lines.filter(l => l.match(/^[\s]*[-•*]\s/)).map(l => l.replace(/^[\s]*[-•*]\s/, ''))
        sections.push(
          <ul key={`list-${blockIdx}`} className="list-disc list-inside space-y-1 my-2 ml-1">
            {items.map((item, idx) => (
              <li key={idx} className="text-xs leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        )
        return
      }

      // Check for numbered list
      if (lines.some(l => l.match(/^[\s]*\d+\.\s/))) {
        const items = lines.filter(l => l.match(/^[\s]*\d+\.\s/)).map(l => l.replace(/^[\s]*\d+\.\s/, ''))
        sections.push(
          <ol key={`olist-${blockIdx}`} className="list-decimal list-inside space-y-1 my-2 ml-1">
            {items.map((item, idx) => (
              <li key={idx} className="text-xs leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ol>
        )
        return
      }

      // Regular paragraph
      if (block.trim()) {
        sections.push(
          <p key={`para-${blockIdx}`} className="text-xs leading-relaxed my-1">
            {renderInline(block.trim())}
          </p>
        )
      }
    })

    return sections
  }

  const content = parseContent()

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg',
        isUser
          ? 'bg-primary text-white ml-auto w-fit max-w-xs'
          : 'bg-muted text-foreground mr-auto w-fit max-w-md'
      )}
    >
      <div className="space-y-1">{content}</div>
    </div>
  )
}
