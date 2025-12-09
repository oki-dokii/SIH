from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline
from docling.datamodel.pipeline_options import PdfPipelineOptions

print("Downloading Docling models... This may take a minute.")

# Initialize pipeline to trigger model download
pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = False
pipeline_options.do_table_structure = True

pipeline = StandardPdfPipeline(pipeline_options=pipeline_options)

print("Download complete! You can now run offline.")
