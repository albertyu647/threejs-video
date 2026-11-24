#!/bin/bash
# Sequential A/B: A without the threejs-video skill (unlinked), B with it.
cd "$(dirname "$0")"; ROOT="$PWD"
P='Make a 10-second video with Three.js: 1080x1920, 30fps, MP4. A 3D extruded word "ORBIT" is revealed with a camera move and glowing particles, ending on a tagline "Launching 2027". Save it as final.mp4 in this folder.'
LINK=~/.claude/skills/threejs-video
relink() { [ -e "$LINK" ] || ln -sfn ../../.agents/skills/threejs-video "$LINK"; }
trap relink EXIT
unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT
run() { # name prompt
  local s=$(date +%s); echo "$1 start $(date '+%H:%M:%S')"
  (cd "$ROOT/$1" && claude -p "$2" --model claude-opus-5-5 --output-format stream-json --verbose --dangerously-skip-permissions > "$ROOT/$1.stream.jsonl" 2> "$ROOT/$1.stderr.log")
  echo "$1 end $(date '+%H:%M:%S') exit=$? wall=$(( $(date +%s) - s ))s"
}
rm -f "$LINK"; [ -e "$LINK" ] && { echo "unlink failed"; exit 1; }; echo "skill hidden"
run a-baseline "$P"
relink; [ -e "$LINK/SKILL.md" ] && echo "skill restored"
run b-skill "$P Use the threejs-video skill."
