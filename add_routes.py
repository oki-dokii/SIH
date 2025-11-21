import re

# Read the existing app.py
with open('backend/app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add CreateComparisonRequest model after ChatResponse
model_addition = """

class CreateComparisonRequest(BaseModel):
    name: str
    dpr_ids: list[int]
"""

content = content.replace(
    'class ChatResponse(BaseModel):\n    reply: str\n    sources: list\n    message_id: int',
    'class ChatResponse(BaseModel):\n    reply: str\n    sources: list\n    message_id: int' + model_addition
)

# Add comparison page routes after dpr_detail_page
page_routes_addition = """

@app.get("/comparison-chat/{comparison_id}/detail", response_class=HTMLResponse)
async def comparison_detail_page(request: Request, comparison_id: int):
    \"\"\"Serve the comparison chat page.\"\"\"
    return templates.TemplateResponse("comparison.html", {"request": request})


@app.get("/comparisons", response_class=HTMLResponse)
async def comparisons_list_page(request: Request):
    \"\"\"Serve the comparisons list page.\"\"\"
    return templates.TemplateResponse("comparisons.html", {"request": request})
"""

target = '@app.get("/dpr/{dpr_id}/detail", response_class=HTMLResponse)\nasync def dpr_detail_page(request: Request, dpr_id: int):\n    """Serve the DPR detail/analysis page."""\n    return templates.TemplateResponse("detail.html", {"request": request})'
content = content.replace(target, target + page_routes_addition)

# Add comparison API endpoints before health check
api_routes_addition = """

# ===== COMPARISON CHAT API ROUTES =====

@app.get("/comparison-chats")
async def list_comparison_chats():
    \"\"\"Get a list of all comparison chats.\"\"\"
    chats = db.get_all_comparison_chats()
    return JSONResponse({"comparisons": chats, "count": len(chats)})


@app.post("/comparison-chats")
async def create_comparison_chat(request: CreateComparisonRequest):
    \"\"\"Create a new comparison chat with selected DPRs.\"\"\"
    if len(request.dpr_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 DPRs required for comparison")
   
    try:
        dprs = []
        for dpr_id in request.dpr_ids:
            dpr = db.get_dpr(dpr_id)
            if not dpr:
                raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
            dprs.append(dpr)
        
        comparison_id = db.create_comparison_chat(request.name, request.dpr_ids)
        print(f"✓ Comparison chat created with ID: {comparison_id} ({len(request.dpr_ids)} PDFs)")
        
        return JSONResponse({
            "comparison_id": comparison_id,
            "name": request.name,
            "dpr_count": len(request.dpr_ids)
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Create comparison error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create comparison: {str(e)}")


@app.get("/comparison-chat/{comparison_id}")
async def get_comparison_chat(comparison_id: int):
    \"\"\"Retrieve a comparison chat with its associated DPRs.\"\"\"
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    return JSONResponse(comparison)


@app.post("/comparison-chat/{comparison_id}/chat")
async def chat_with_comparison(comparison_id: int, chat_message: ChatMessage):
    \"\"\"Send a chat message to a comparison and get a response.\"\"\"
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    
    try:
        print(f"⏳ Processing comparison chat message for comparison {comparison_id}")
        db.insert_comparison_message(comparison_id, "user", chat_message.message)
        file_refs = [dpr["uploaded_file_ref"] for dpr in comparison["dprs"]]
        response = gemini_client.send_comparison_message(comparison_id=comparison_id, message=chat_message.message, file_refs=file_refs)
        db.insert_comparison_message(comparison_id, "assistant", response['reply'])
        messages = db.get_comparison_messages(comparison_id)
        message_id = messages[-1]['id'] if messages else 0
        return JSONResponse({"reply": response['reply'], "sources": response.get('sources', []), "message_id": message_id})
    except Exception as e:
        print(f"✗ Comparison chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Comparison chat failed: {str(e)}")


@app.get("/comparison-chat/{comparison_id}/chat/history")
async def get_comparison_chat_history(comparison_id: int):
    \"\"\"Retrieve the complete chat history for a comparison.\"\"\"
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    messages = db.get_comparison_messages(comparison_id)
    return JSONResponse({"comparison_id": comparison_id, "messages": messages, "count": len(messages)})


@app.delete("/comparison-chat/{comparison_id}/chat")
async def clear_comparison_chat(comparison_id: int):
    \"\"\"Clear all chat history for a comparison.\"\"\"
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    
    try:
        deleted_count = db.clear_comparison_history(comparison_id)
        gemini_client.clear_comparison_chat_session(comparison_id)
        return JSONResponse({"success": True, "deleted_count": deleted_count, "message": f"Cleared {deleted_count} messages"})
    except Exception as e:
        print(f"✗ Clear comparison chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear comparison chat: {str(e)}")

"""

content = content.replace('@app.get("/health")', api_routes_addition + '@app.get("/health")')

# Write the updated content
with open('backend/app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Successfully added all comparison routes to app.py!")
