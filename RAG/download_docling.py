import torch
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.accelerator_options import AcceleratorOptions

print("Downloading Docling models... This may take a minute.")

# Detect GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")
if device == "cuda":
    print(f"GPU detected: {torch.cuda.get_device_name(0)}")

# Initialize pipeline to trigger model download
pipeline_options = PdfPipelineOptions()
pipeline_options.accelerator_options = AcceleratorOptions(device=device)  # Correct way
pipeline_options.do_ocr = False
pipeline_options.do_table_structure = True

pipeline = StandardPdfPipeline(pipeline_options=pipeline_options)

print("Download complete! You can now run offline.")
