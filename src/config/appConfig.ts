export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  UPLOAD = 'upload',
}

export interface AppErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    role: string | undefined;
  }
}

export function handleAppError(error: unknown, operationType: OperationType, path: string | null, currentUser?: any) {
  const errInfo: AppErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?._id || currentUser?.userId,
      email: currentUser?.email,
      role: currentUser?.role,
    },
    operationType,
    path
  }
  console.error('App Error: ', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}
