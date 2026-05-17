# Content Templates

This directory contains MDX templates for every content type published on AI Execution Lab.

Templates are **not** published as pages — they live here for file-system copying.

## How to use

Copy the relevant template to the appropriate content directory:

| Template | Copy to |
|---|---|
| `execution-log.mdx` | `content/logs/YYYY-MM-DD-[slug].mdx` |
| `failure-report.mdx` | `content/failures/[slug].mdx` |
| `lesson.mdx` | `content/lessons/[track]/[module]/[lesson].mdx` |
| `playbook.mdx` | `content/playbooks/[slug].mdx` |
| `case-study.mdx` | `content/case-studies/[slug].mdx` |
| `geo-experiment.mdx` | `content/labs/geo-[slug].mdx` |
| `system-doc.mdx` | `content/systems/[slug].mdx` |

Remove all lines starting with `#` (template comments) before publishing.

## Browser access

All templates are also available in the Lab UI at:
`/docs/content-templates`
