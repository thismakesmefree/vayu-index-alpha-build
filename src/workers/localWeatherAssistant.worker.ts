import {
  env,
  pipeline,
  type TextGenerationPipeline,
} from '@huggingface/transformers';
import {
  buildWeatherAdviceMessages,
  type LocalWeatherAssistantEvent,
  type LocalWeatherAssistantRequest,
} from '../utils/localWeatherAssistant';

const MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<LocalWeatherAssistantRequest>) => void) | null;
  postMessage: (message: LocalWeatherAssistantEvent) => void;
};

let generator: TextGenerationPipeline | null = null;
let generatorPromise: Promise<TextGenerationPipeline> | null = null;

function post(message: LocalWeatherAssistantEvent): void {
  workerScope.postMessage(message);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function progressCallback(info: { status: string; file?: string; progress?: number }): void {
  post({
    type: 'progress',
    progress: typeof info.progress === 'number' ? info.progress : null,
    file: info.file ?? info.status,
  });
}

async function createGenerator(): Promise<TextGenerationPipeline> {
  env.useBrowserCache = true;
  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter: () => Promise<unknown | null> };
  }).gpu;
  let useWebGpu = false;

  if (gpu) {
    try {
      useWebGpu = (await gpu.requestAdapter()) !== null;
    } catch (error) {
      post({
        type: 'phase',
        phase: 'loading',
        message: `GPU setup unavailable; using CPU instead. ${errorText(error)}`,
      });
    }
  }

  const options = {
    dtype: 'q4' as const,
    progress_callback: progressCallback,
    ...(useWebGpu ? { device: 'webgpu' as const } : {}),
  };

  try {
    return await pipeline('text-generation', MODEL_ID, options);
  } catch (gpuError) {
    if (!useWebGpu) throw gpuError;
    post({
      type: 'phase',
      phase: 'loading',
      message: 'GPU initialization failed; retrying with the CPU runtime.',
    });
    try {
      return await pipeline('text-generation', MODEL_ID, {
        dtype: 'q4',
        progress_callback: progressCallback,
      });
    } catch (cpuError) {
      throw new Error(
        `GPU startup failed (${errorText(gpuError)}); CPU fallback failed (${errorText(cpuError)}).`
      );
    }
  }
}

async function getGenerator(): Promise<TextGenerationPipeline> {
  if (generator) return generator;
  if (!generatorPromise) generatorPromise = createGenerator();
  try {
    generator = await generatorPromise;
    return generator;
  } finally {
    generatorPromise = null;
  }
}

workerScope.onmessage = async ({ data }) => {
  if (data.type !== 'generate') return;

  try {
    post({
      type: 'phase',
      phase: 'loading',
      message: 'Preparing the local model. The first download is about 400 MB.',
    });
    const model = await getGenerator();
    post({
      type: 'phase',
      phase: 'generating',
      message: 'Generating advice on your device…',
    });

    const output = await model(buildWeatherAdviceMessages(data.weatherContext, data.question), {
      max_new_tokens: 200,
      do_sample: false,
      repetition_penalty: 1.08,
    });
    const answer = output[0]?.generated_text.at(-1)?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      throw new Error('The local model returned an empty response. Try a shorter question.');
    }
    post({ type: 'answer', answer: answer.trim() });
  } catch (error) {
    generator = null;
    generatorPromise = null;
    post({ type: 'error', message: errorText(error) });
  }
};
