let visibleJobId: string | null = null;

export function setVisibleJobId(jobId: string | null) {
  visibleJobId = jobId;
}

export function getVisibleJobId() {
  return visibleJobId;
}
