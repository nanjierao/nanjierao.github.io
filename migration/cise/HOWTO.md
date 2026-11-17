# The old CISE page (cise.ufl.edu/~nr0) points to nanjierao.github.io

**Done on Oct 30, 2026 (D63).** Checked from a Mac the same day:

| Address | Answer |
|---|---|
| `https://www.cise.ufl.edu/~nr0/` | 301 → `https://nanjierao.github.io/` |
| `https://www.cise.ufl.edu/~<GatorLink username>/` | 301 → `https://nanjierao.github.io/` |
| `…/dissertation.html` | 301 → `https://nanjierao.github.io/research/teacher-support/` |
| `…/enactment.html` | 301 → `https://nanjierao.github.io/research/embodied-learning/` |

Both addresses serve the same folder: `~/public_html` of the GatorLink account. The two files in
this folder are copies of what is there now: `.htaccess` (a hidden file) and `index.html`, the
fallback page in case the server ever ignores `.htaccess`. The old homepage is saved outside the
web folder as `~/index.html.backup-2026`.

Only the old site's pages redirect. The other folders in `public_html` (study platforms, demos,
course material) keep working at their old addresses.

## Log in

```bash
ssh rain.cise.ufl.edu -l GATORLINK
```

Use GatorLink credentials. Some SSH clients need the username with `@ufl.edu` added; the
server's login notice lists the accepted forms. The login shell is tcsh, which doesn't understand
bash syntax such as `2>&1` or the commands below: type `bash` first.

## Check it (on the Mac)

```bash
curl -sI https://www.cise.ufl.edu/~nr0/ | grep -iE "^HTTP|^location"
curl -sI https://www.cise.ufl.edu/~nr0/dissertation.html | grep -iE "^HTTP|^location"
```

Expected: `301` and a `location:` on nanjierao.github.io. A `200` means the server ignored
`.htaccess`; `index.html` still sends visitors of the homepage on.

## Set it up again (e.g. on a new account)

In bash on rain:

```bash
cd ~/public_html
cp -a index.html ~/index.html.backup-2026
cat > .htaccess <<'HT'
RedirectMatch 301 ^/~[^/]+/?$                   https://nanjierao.github.io/
RedirectMatch 301 ^/~[^/]+/index\.html$         https://nanjierao.github.io/
RedirectMatch 301 ^/~[^/]+/dissertation\.html$  https://nanjierao.github.io/research/teacher-support/
RedirectMatch 301 ^/~[^/]+/enactment\.html$     https://nanjierao.github.io/research/embodied-learning/
HT
cat > index.html <<'IDX'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nanjie (Jimmy) Rao — moved to nanjierao.github.io</title><link rel="canonical" href="https://nanjierao.github.io/"><meta http-equiv="refresh" content="0; url=https://nanjierao.github.io/"><meta name="robots" content="noindex, follow"></head><body><p>This page has moved to <a href="https://nanjierao.github.io/">nanjierao.github.io</a>.</p></body></html>
IDX
chmod 644 .htaccess index.html
```

The patterns match `/~<any username>/`, so the rules work at both addresses. The home folder
already had the permissions the web server needs (`drwx-----x`); leave them.

## Undo

In bash on rain:

```bash
rm ~/public_html/.htaccess && cp -a ~/index.html.backup-2026 ~/public_html/index.html
```

## Still open

- Ask CISE support (the address is in the server's login notice) how long the account and its
  web folder stay after graduation in December 2026. The redirect lasts only as long as they do.
- Point the original links at the new site too: Google Scholar's homepage field and any lab or UF
  profile pages that link to the CISE address.
