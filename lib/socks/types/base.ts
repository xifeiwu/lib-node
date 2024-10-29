/** Base type for any version protocol */
import {RequestTargetV5} from './v5';

export type RequestTarget = RequestTargetV5 | string;

export type TracerItem = string | {key: string; value: any};
export type StateTracer = Array<TracerItem>;
