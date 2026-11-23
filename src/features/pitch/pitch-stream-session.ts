import { createPitchStream, readPitchSse } from "@/shared/api/sse";

export type PitchSsePacket = {
  event: string;
  data: Record<string, unknown>;
};

export type CreateStreamSeed = {
  userText: string;
};

type CreateSession = {
  pitchId: string | null;
  seed: CreateStreamSeed;
  buffer: PitchSsePacket[];
  done: boolean;
  failed: boolean;
  failDetail: string | null;
  subscribers: Set<(packet: PitchSsePacket) => void>;
  doneSubscribers: Set<() => void>;
};

let createSession: CreateSession | null = null;

function publish(session: CreateSession, packet: PitchSsePacket) {
  session.buffer.push(packet);
  for (const subscriber of session.subscribers) {
    subscriber(packet);
  }
}

/**
 * Starts POST /v1/pitches, resolves with pitch id on `ready`, and keeps
 * reading the SSE body in the background so PitchResults can attach.
 */
export async function beginCreatePitchStream(input: {
  message?: string;
  file?: File | null;
}): Promise<string> {
  if (createSession && !createSession.done) {
    throw new Error("A pitch is already being started.");
  }

  const userText = input.file
    ? `Uploaded ${input.file.name}`
    : (input.message ?? "").trim();

  const session: CreateSession = {
    pitchId: null,
    seed: { userText },
    buffer: [],
    done: false,
    failed: false,
    failDetail: null,
    subscribers: new Set(),
    doneSubscribers: new Set(),
  };
  createSession = session;

  let response: Response;
  try {
    response = await createPitchStream(input);
  } catch (caught) {
    createSession = null;
    throw caught;
  }

  let resolveReady: ((pitchId: string) => void) | null = null;
  let rejectReady: ((error: Error) => void) | null = null;
  let readySettled = false;

  const readyPromise = new Promise<string>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  void readPitchSse(response, (event, data) => {
    if (event === "ready" && typeof data.pitch_id === "string" && !readySettled) {
      readySettled = true;
      session.pitchId = data.pitch_id;
      resolveReady?.(data.pitch_id);
    }
    publish(session, { event, data });
    if (event === "error" && !readySettled) {
      readySettled = true;
      const detail = String(data.detail ?? "The pitch could not be started.");
      session.failed = true;
      session.failDetail = detail;
      createSession = null;
      rejectReady?.(new Error(detail));
    }
  })
    .then(() => {
      if (!readySettled) {
        readySettled = true;
        createSession = null;
        rejectReady?.(new Error("The pitch was not created."));
      }
    })
    .catch((caught: unknown) => {
      const detail =
        caught instanceof Error ? caught.message : "The pitch could not be started.";
      session.failed = true;
      session.failDetail = detail;
      if (!readySettled) {
        readySettled = true;
        createSession = null;
        rejectReady?.(new Error(detail));
      } else {
        publish(session, { event: "error", data: { detail } });
      }
    })
    .finally(() => {
      session.done = true;
      for (const subscriber of session.doneSubscribers) {
        subscriber();
      }
    });

  return readyPromise;
}

export function getCreateStreamSeed(pitchId: string): CreateStreamSeed | null {
  if (createSession?.pitchId === pitchId) {
    return createSession.seed;
  }
  return null;
}

export function isCreateStreamActive(pitchId: string): boolean {
  return Boolean(
    createSession &&
      createSession.pitchId === pitchId &&
      (!createSession.done || createSession.buffer.length > 0),
  );
}

/**
 * Replay buffered packets and subscribe to further ones for this pitch.
 * Returns null if there is no matching create stream.
 */
export function attachCreateStream(
  pitchId: string,
  onPacket: (packet: PitchSsePacket) => void,
  onDone?: () => void,
): (() => void) | null {
  const session = createSession;
  if (!session || session.pitchId !== pitchId) {
    return null;
  }

  for (const packet of session.buffer) {
    onPacket(packet);
  }

  session.subscribers.add(onPacket);
  if (onDone) {
    session.doneSubscribers.add(onDone);
    if (session.done) {
      onDone();
    }
  }

  return () => {
    session.subscribers.delete(onPacket);
    if (onDone) {
      session.doneSubscribers.delete(onDone);
    }
  };
}

export function clearCreateStream(pitchId: string) {
  if (createSession?.pitchId === pitchId) {
    createSession = null;
  }
}
