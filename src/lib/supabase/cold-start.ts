/**
 * Supabase 免費 project 閒置耐咗會休眠。第一個訪客叫醒佢嗰陣，PostgREST 啱啱重啟、
 * schema cache 仲係空，就會回 PGRST205「Could not find the table ... in the schema cache」。
 * 等一兩秒再試通常就成功，所以要同「真・設定錯誤」（未跑 schema.sql／env var 填錯）分開處理。
 */

export const COLD_START_CODE = "PGRST205";

export type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
};

export type QueryResult<T> = {
  data: T | null;
  error: PostgrestLikeError | null;
};

/** 判斷個 error 係咪「資料庫啟動中」而唔係真係冇張表 */
export function isColdStartError(
  error: PostgrestLikeError | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === COLD_START_CODE) return true;
  return /schema cache/i.test(error.message ?? "");
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export type RetryOptions = {
  /** 總共試幾多次（包括第一次）。預設 3。 */
  attempts?: number;
  /** 第 n 次失敗之後等幾耐（毫秒），n 由 1 開始。預設 800ms、1600ms。 */
  delayMs?: (attempt: number) => number;
  /** 方便測試時注入假 sleep */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * 行 `run()`，如果撞到冷啟動 error 就等陣再試。
 * 其他 error（或者成功）即刻回，唔會白等。
 */
export async function retryOnColdStart<T>(
  run: () => Promise<QueryResult<T>>,
  options: RetryOptions = {}
): Promise<QueryResult<T>> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = options.delayMs ?? ((attempt: number) => 800 * 2 ** (attempt - 1));
  const sleep = options.sleep ?? defaultSleep;

  let result = await run();
  for (let attempt = 1; attempt < attempts; attempt++) {
    if (!isColdStartError(result.error)) return result;
    await sleep(delayMs(attempt));
    result = await run();
  }
  return result;
}
