import { MDXRemote } from 'next-mdx-remote/rsc'
import { mdxComponents, WorkflowBlock, WorkflowStep, PromptBlock, CodeBlock, StepList, Checklist } from './mdx-components'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

const allComponents = {
  ...mdxComponents,
  WorkflowBlock,
  WorkflowStep,
  PromptBlock,
  CodeBlock,
  StepList,
  Checklist,
}

interface ContentRendererProps {
  source: string
}

export async function ContentRenderer({ source }: ContentRendererProps) {
  return (
    <div className="prose-lab">
      <MDXRemote
        source={source}
        components={allComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              rehypeHighlight,
              rehypeSlug,
              [
                rehypeAutolinkHeadings,
                {
                  behavior: 'wrap',
                  properties: { className: ['anchor'] },
                },
              ],
            ],
          },
        }}
      />
    </div>
  )
}
