# Snovalang Technical Documentation (Jekyll)

Multilingual technical documentation for **Snovalang** and the **snovac** compiler, built with [Jekyll](https://jekyllrb.com/).

## Supported Languages

- **English** (`/en/`)
- **Português Brasileiro** (`/pt-br/`)
- **Español** (`/es/`)

Every page carries a matching `page_id` in front matter so the language switcher resolves directly to the equivalent technical reference page in the selected locale.

## Local Development

### Prerequisites

- Ruby 3.1+
- Bundler (`gem install bundler`)

### Serve locally

```sh
bundle install
bundle exec jekyll serve --livereload
```

Open `http://127.0.0.1:4000`.

### Production build

```sh
JEKYLL_ENV=production bundle exec jekyll build
```

The generated static site is written to `_site/`.

## GitHub Pages Deployment

The included workflow at `.github/workflows/pages.yml` builds the site with Bundler + Jekyll and deploys via GitHub Pages Actions on pushes to `main` or `master`.
