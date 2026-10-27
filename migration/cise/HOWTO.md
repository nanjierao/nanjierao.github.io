# Point the old CISE page (cise.ufl.edu/~nr0) to nanjierao.github.io

One-time, about 5 minutes. **Do this only after the real homepage is live at
https://nanjierao.github.io** (after S3), or visitors will land on a placeholder.

## 1. Log in to a CISE server

```bash
ssh rain.cise.ufl.edu -l YOUR_LOGIN
```

`YOUR_LOGIN` is the name you normally use on the CISE servers. CISE asks new accounts to use
`GatorLinkID@ufl.edu`; older accounts may use the CISE username, `nr0`.

## 2. Back up the old site, then add the two files

Paste this whole block into the SSH session:

```bash
cp -a ~/public_html ~/public_html_backup_2026 && cd ~/public_html
cat > .htaccess <<'HT'
RedirectMatch 301 ^/~nr0/?$                   https://nanjierao.github.io/
RedirectMatch 301 ^/~nr0/index\.html$         https://nanjierao.github.io/
RedirectMatch 301 ^/~nr0/dissertation\.html$  https://nanjierao.github.io/research/
RedirectMatch 301 ^/~nr0/enactment\.html$     https://nanjierao.github.io/builds/
RedirectMatch 301 ^/~nr0/.*$                  https://nanjierao.github.io/
HT
cat > index.html <<'IDX'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nanjie (Jimmy) Rao — moved to nanjierao.github.io</title><link rel="canonical" href="https://nanjierao.github.io/"><meta http-equiv="refresh" content="0; url=https://nanjierao.github.io/"><meta name="robots" content="noindex, follow"></head><body><p>This page has moved to <a href="https://nanjierao.github.io/">nanjierao.github.io</a>.</p></body></html>
IDX
chmod 711 ~ && chmod 755 ~/public_html && chmod 644 ~/public_html/.htaccess ~/public_html/index.html
exit
```

## 3. Check it (on your Mac)

```bash
curl -sI https://www.cise.ufl.edu/~nr0/ | grep -iE "^HTTP|^location"
```

Expected: `HTTP/... 301` and `location: https://nanjierao.github.io/`.
If you get `200` instead, the server ignored `.htaccess`. The `index.html` still redirects
visitors, so you're done either way.

## Undo

```bash
ssh rain.cise.ufl.edu -l YOUR_LOGIN
rm ~/public_html/.htaccess && cp -a ~/public_html_backup_2026/index.html ~/public_html/
```
