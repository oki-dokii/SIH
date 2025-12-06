"""
GPU Diagnostics Script for RAG Pipeline

Checks if CUDA is available and displays GPU information.
Run this script to verify GPU setup before using the RAG application.
"""

import torch

def check_gpu():
    print("=" * 60)
    print("GPU DIAGNOSTICS")
    print("=" * 60)
    
    # Check CUDA availability
    cuda_available = torch.cuda.is_available()
    print(f"\nCUDA Available: {cuda_available}")
    
    if cuda_available:
        print(f"CUDA Version: {torch.version.cuda}")
        print(f"Number of GPUs: {torch.cuda.device_count()}")
        
        for i in range(torch.cuda.device_count()):
            print(f"\n--- GPU {i} ---")
            print(f"Name: {torch.cuda.get_device_name(i)}")
            
            # Memory info
            total_memory = torch.cuda.get_device_properties(i).total_memory / (1024**3)
            print(f"Total Memory: {total_memory:.2f} GB")
            
            if torch.cuda.is_initialized():
                allocated = torch.cuda.memory_allocated(i) / (1024**3)
                reserved = torch.cuda.memory_reserved(i) / (1024**3)
                print(f"Allocated Memory: {allocated:.2f} GB")
                print(f"Reserved Memory: {reserved:.2f} GB")
        
        print("\n✅ GPU is ready for use!")
        print("   Docling will use CUDA accelerator for PDF processing.")
    else:
        print("\n❌ No GPU detected or CUDA not available.")
        print("   Docling will fall back to CPU processing.")
        print("\nPossible reasons:")
        print("   - PyTorch installed without CUDA support")
        print("   - NVIDIA drivers not installed")
        print("   - No NVIDIA GPU in system")
    
    print("=" * 60)

if __name__ == "__main__":
    check_gpu()
