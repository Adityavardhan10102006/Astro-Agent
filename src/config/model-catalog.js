/**
 * ASTRO Approved Local Model Catalog
 * Complies with Rule 3, Rule 6, Rule 10, Rule 11
 */

const APPROVED_MODELS = [
  {
    id: 'qwen2.5-coder-7b-instruct',
    name: 'Qwen2.5-Coder-7B-Instruct',
    author: 'Alibaba Cloud (Qwen Team)',
    repoId: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    license: 'Apache-2.0',
    description: 'Premier open-source code generation, reasoning, and instruction model. Default for ASTRO.',
    format: 'GGUF',
    contextLength: 32768,
    isDefault: true,
    hardwareRequirement: {
      minRamGB: 8,
      recommendedRamGB: 16,
      minFreeDiskGB: 10,
      cpuTarget: 'x86_64 AVX2 (Ryzen 5 compatible)'
    },
    quantizations: [
      {
        tag: 'Q4_K_M',
        filename: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',
        recommended: true,
        approxSizeGB: 4.68,
        description: 'Standard 4-bit quantization with medium tensor weighting. Excellent balance of quality and RAM.'
      },
      {
        tag: 'Q5_K_M',
        filename: 'qwen2.5-coder-7b-instruct-q5_k_m.gguf',
        recommended: false,
        approxSizeGB: 5.43,
        description: '5-bit quantization. Higher precision, requires more free RAM.'
      },
      {
        tag: 'Q8_0',
        filename: 'qwen2.5-coder-7b-instruct-q8_0.gguf',
        recommended: false,
        approxSizeGB: 8.19,
        description: 'High precision 8-bit. Recommended only if >16GB RAM is available.'
      }
    ]
  },
  {
    id: 'qwen2.5-coder-1.5b-instruct',
    name: 'Qwen2.5-Coder-1.5B-Instruct',
    author: 'Alibaba Cloud (Qwen Team)',
    repoId: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    license: 'Apache-2.0',
    description: 'Lightweight local model for ultra-fast startup and memory-constrained environments.',
    format: 'GGUF',
    contextLength: 32768,
    isDefault: false,
    hardwareRequirement: {
      minRamGB: 4,
      recommendedRamGB: 8,
      minFreeDiskGB: 3,
      cpuTarget: 'x86_64 AVX2'
    },
    quantizations: [
      {
        tag: 'Q4_K_M',
        filename: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
        recommended: true,
        approxSizeGB: 1.12,
        description: 'Fastest loading, ultra-low memory footprint (~1.2GB RAM).'
      }
    ]
  },
  {
    id: 'qwen3-8b',
    name: 'Qwen3-8B',
    author: 'Alibaba Cloud (Qwen Team)',
    repoId: 'Qwen/Qwen3-8B-GGUF',
    baseRepoId: 'Qwen/Qwen3-8B',
    license: 'Apache-2.0',
    description: 'Next-generation Qwen 8B dense language and reasoning model with enhanced multi-turn reasoning and coding capabilities.',
    format: 'GGUF',
    contextLength: 32768,
    isDefault: false,
    hardwareRequirement: {
      minRamGB: 8,
      recommendedRamGB: 16,
      minFreeDiskGB: 12,
      cpuTarget: 'x86_64 AVX2 (Ryzen 5 compatible)'
    },
    quantizations: [
      {
        tag: 'Q4_K_M',
        filename: 'Qwen3-8B-Q4_K_M.gguf',
        recommended: true,
        approxSizeGB: 4.68,
        sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
        description: 'Standard 4-bit medium tensor quantization. Optimal balance of reasoning precision and RAM usage.'
      },
      {
        tag: 'Q5_K_M',
        filename: 'Qwen3-8B-Q5_K_M.gguf',
        recommended: false,
        approxSizeGB: 5.45,
        sha256: '068bae163faa96ad48032daf4e071a6a28fe67d8dcc95367609c2ff165e52738',
        description: '5-bit medium tensor quantization for higher precision.'
      },
      {
        tag: 'Q8_0',
        filename: 'Qwen3-8B-Q8_0.gguf',
        recommended: false,
        approxSizeGB: 8.11,
        sha256: '408b955510e196121c1c375201744783b5c9a43c7956d73fc78df54c66e883d6',
        description: 'High precision 8-bit quantization. Recommended only if >16GB RAM is available.'
      }
    ]
  }
];

module.exports = {
  APPROVED_MODELS
};
