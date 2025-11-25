# Multi-Language System Implementation

## Overview
The DPR Analyzer now supports full bidirectional multi-language functionality, allowing users to view document analysis in different languages by toggling the language selector.

## How It Works

### 1. **Upload Time - Multi-Language Generation**
When a user uploads a PDF:
- The AI generates analysis in **ALL supported languages** (currently: English & Hindi)
- Processing time: ~30-60 seconds per language (2 languages = 60-120 seconds total)
- All language versions are stored in the database under `summary_json_multilang`

### 2. **Language Toggle - Instant Switching**
When a user toggles the language (हिं ↔ EN):
- The frontend re-fetches the document with the new language parameter
- The backend returns the pre-generated content for that language
- No AI processing required - instant language switching

### 3. **Supported Languages (Current)**
- **en** - English
- **hi** - Hindi (हिंदी)

### 4. **Future Language Support**
To add new languages (e.g., Assamese, Bengali, etc.):
1. Add language code to `supported_languages` array in `backend/app.py` (line 149)
2. Add translation strings to `frontend/src/lib/i18n.ts`
3. All future uploads will automatically include the new language

## Technical Implementation

### Backend Changes

**Database Schema** (`backend/db.py`):
```python
# Added new column for multi-language storage
summary_json_multilang TEXT  # Stores: {"en": {...}, "hi": {...}}
```

**Upload Endpoint** (`backend/app.py` line 100-169):
```python
# Generates content in ALL supported languages
supported_languages = ["en", "hi"]
multilang_json = {}

for lang in supported_languages:
    multilang_json[lang] = gemini_client.generate_json_from_file(file_ref, schema, language=lang)
```

**GET Endpoint** (`backend/app.py` line 188-215):
```python
# Returns content in requested language
@app.get("/dpr/{dpr_id}")
async def get_dpr(dpr_id: int, language: str = "en"):
    # Selects correct language version from multilang_json
    if language in multilang_data:
        dpr["summary_json"] = multilang_data[language]
```

### Frontend Changes

**API Layer** (`frontend/src/lib/api.ts`):
```typescript
// Upload with language parameter
async uploadDPR(file: File, language: string = 'en', onProgress)

// Get document in specific language
async getDPR(id: number, language: string = 'en')
```

**Document Detail Page** (`frontend/src/pages/DocumentDetail.tsx`):
```typescript
// Re-fetches document when language changes
useEffect(() => {
    loadDocument(parseInt(id))
}, [id, language])

async function loadDocument(dprId: number) {
    const doc = await api.getDPR(dprId, language)
}
```

## What Gets Translated

### ✅ Translated Content (AI-Generated)
- Executive summaries
- Project vision & mission statements
- Risk assessments & recommendations
- Financial analysis descriptions
- Environmental impact assessments
- All narrative/descriptive text

### ❌ Non-Translated Content (Technical Data)
- Numbers, percentages, dates
- Project names, locations
- Budget figures
- Timeline durations
- Technical terms (DPR, MDoNER, etc.)
- JSON field names

## Benefits

1. **Future-Proof**: Add languages by modifying one array
2. **Instant Switching**: Pre-generated content = no waiting
3. **Scalable**: Works for 2-10+ languages with same architecture
4. **User-Friendly**: Upload once, view in any language
5. **Backward Compatible**: Existing documents still work (fallback to English)

## Performance Considerations

- **Upload time increases linearly**: Each new language adds ~30-60 seconds
- **Storage increases**: ~2-3x database size for 2-3 languages
- **No runtime performance impact**: Language switching is instant
- **Cost**: AI API calls scale with number of languages (2 languages = 2x API cost per upload)

## Usage Example

1. User selects Hindi (हिं) from language toggle
2. User uploads a DPR PDF
3. System generates analysis in English + Hindi (~90 seconds)
4. User sees Hindi analysis
5. User toggles to English → Instantly shows English version
6. User toggles back to Hindi → Instantly shows Hindi version

## Migration Path

**Existing Documents** (uploaded before this feature):
- Will have `summary_json_multilang = null`
- Will fallback to English content from `summary_json`
- Won't have bidirectional language support unless re-uploaded

**New Documents** (uploaded after this feature):
- Full multi-language support
- Can toggle between all supported languages
