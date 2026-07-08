import { episodeTypeLabels } from "../config/filters";
import type { EpisodeType } from "../types/domain";

export function EpisodeBadge({ type }: { type: EpisodeType }) {
  return <span className={`badge badge-${type}`}>{episodeTypeLabels[type]}</span>;
}

export function FinaleBadge() {
  return <span className="badge badge-season_finale">finale</span>;
}
