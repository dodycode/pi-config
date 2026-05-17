# bash-guard (pi extension)

Intercepts agent-issued `bash` tool calls and decides whether to run them silently,
prompt for confirmation, or block them.

## Decision tree

Each segment of a chained command (`&&`, `||`, `;`, `|`) is checked in order:

```
   1. all path args (incl. > redirect target) inside /tmp ?      → silent
   2. matches an ALWAYS_PROMPT pattern ?                          → prompt
   3. read-only command AND no write redirect (> >> 2> 2>>) ?     → silent
   4. CWD inside $HOME AND (no path args
      OR every path arg inside $HOME) ?                           → silent
   5. otherwise                                                   → prompt
```

The strictest verdict across all segments wins. A `curl ... | bash` chain
short-circuits to prompt before per-segment analysis.

## ALWAYS_PROMPT — catastrophic patterns

These prompt every time regardless of CWD, paths, or anything else:

| Pattern | Reason |
|---|---|
| `rm`, `rmdir`, `unlink` | file deletion |
| `find … -delete` | bulk deletion |
| `git rm` | removes files from working tree |
| `git clean -f` (any `-…f…` flag) | delete untracked files |
| `git reset --hard` | discard uncommitted changes |
| `git push --force` / `--force-with-lease` / `-f` | rewrite remote history |
| `git reflog expire` | remove recovery history |
| `git gc --prune` | permanently delete objects |
| `sudo` | elevated privileges |
| `mkfs*`, `newfs_*`, `wipefs` | filesystem formatting / wipe |
| `parted`, `fdisk`, `gdisk`, `sgdisk` | partition table management |
| `cryptsetup` | disk encryption management |
| `diskutil erase / zeroDisk / secureErase / reformat` | destructive disk op |
| `pvcreate`, `vgcreate`, `lvcreate`, `zpool` | volume management |
| `dd of=/dev/…` | raw disk write |
| `shutdown`, `reboot`, `halt`, `poweroff` | system power op |
| `curl … \| sh` / `wget … \| sh` (any shell) | pipe to shell (RCE) |
| `terraform destroy` | infrastructure teardown |
| `kubectl delete` | Kubernetes resource deletion |
| `aws s3 rm … --recursive` | bulk S3 deletion |
| `gcloud … delete` | cloud resource deletion |

## READ-only commands — silent even with paths outside $HOME

`cat`, `less`, `more`, `head`, `tail`, `bat`,
`ls`, `tree`, `lsof`, `ps`, `top`, `htop`, `lsblk`,
`grep`, `rg`, `egrep`, `fgrep`, `ack`,
`find` (without `-delete`),
`wc`, `du`, `df`, `stat`, `file`,
`pwd`, `echo`, `printf`, `whoami`, `id`, `uname`, `hostname`, `date`,
`env`, `printenv`, `which`, `whereis`, `type`, `command`,
`realpath`, `readlink`, `basename`, `dirname`,
and read-only git subcommands:
`status`, `log`, `diff`, `show`, `blame`,
`ls-files`, `ls-tree`, `ls-remote`,
`rev-parse`, `rev-list`,
`describe`, `shortlog`, `whatchanged`,
`fsck`, `count-objects`, `verify-pack`.

A read-only command becomes a "write" the moment it has a `>` / `>>` / `2>` / `2>>`
redirection — at that point rule 3 no longer applies and rule 4 (CWD + path scope)
decides.

## Behavior by mode

Behavior is determined by the `PI_SUBAGENT_DEPTH` environment variable, which
pi-subagents injects into every spawned process.

### Main session (`PI_SUBAGENT_DEPTH` = 0 or unset)

- Verdict `silent` → command runs without interruption.
- Verdict `prompt` → 2-option dialog **Run** / **Abort**. Abort returns a block
  reason to the model so it can adapt.

### Subagent (`PI_SUBAGENT_DEPTH` ≥ 1)

Same decision tree, but spawned subagents have no UI (`stdin` is `/dev/null`).

- Verdict `silent` → command runs.
- Verdict `prompt` → command is hard-blocked with a clear reason. The parent
  agent can then ask the human for confirmation and either re-run from the main
  session or relay an alternative back.

## Configuration

- `--bash-guard-auto-allow` (boolean flag, main session only): when set and the
  main session has no UI available, allow flagged commands instead of aborting.
  Useful for non-interactive `pi` runs. Has no effect in subagent sessions.

## Install

Auto-discovered from `~/.pi/agent/extensions/bash-guard/`. Run `/reload` in pi
after editing.

## Notes

- Scope: `bash` tool calls only (`write` / `edit` and user `!` commands are not
  intercepted).
- Paths are detected only when an argument starts with `/`, `~`, `./`, `../`, or
  is exactly `.` / `..`. Bare filenames like `package.json` are not treated as
  paths, which is correct — rule 4 trusts CWD-relative work inside `$HOME`.
- Multi-segment commands (`&&`, `||`, `;`, `|`) are split and checked per
  segment. Any prompting segment forces the whole call to prompt.
