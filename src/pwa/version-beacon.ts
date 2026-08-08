import { BUILD_HASH_SHORT } from "../build-info";

export type VersionBeacon = {
  readonly commit: string;
  readonly releaseId: string;
};

const normalizeCommit = (commit: string): string => commit.slice(0, 6);

export const isRemoteVersionNewer = (
  remoteCommit: string,
  localCommit: string = BUILD_HASH_SHORT,
): boolean => {
  const remote = normalizeCommit(remoteCommit);
  const local = normalizeCommit(localCommit);
  if (!remote || !local) {
    return false;
  }
  return remote !== local;
};

export const fetchRemoteVersion = async (): Promise<VersionBeacon | null> => {
  try {
    const url = new URL("./version.json", window.location.href);
    url.searchParams.set("t", String(Date.now()));
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const data: unknown = await res.json();
    if (
      typeof data !== "object" ||
      data == null ||
      typeof (data as { commit?: unknown }).commit !== "string"
    ) {
      return null;
    }
    const record = data as { commit: string; releaseId?: unknown };
    return {
      commit: record.commit,
      releaseId: typeof record.releaseId === "string" ? record.releaseId : "",
    };
  } catch {
    return null;
  }
};
