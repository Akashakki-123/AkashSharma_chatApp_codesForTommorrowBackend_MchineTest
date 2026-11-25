export interface FormatterResult<T = unknown> {
  status: boolean;
  message: string;
  data?: T;
  statusCode?: number;
}

export function returnFormatter<T = never>(
  status: false,
  message: string,
  data?: undefined,
  statusCode?: number
): FormatterResult<T>;
export function returnFormatter<T = unknown>(
  status: boolean,
  message: string,
  data?: T,
  statusCode?: number
): FormatterResult<T>;
export function returnFormatter<T = unknown>(
  status: boolean,
  message: string,
  data?: T,
  statusCode?: number
): FormatterResult<T> {
  return { status, message, data, statusCode };
}
