import { MDXRemote } from 'next-mdx-remote/rsc'
import { mdxComponents, WorkflowBlock, WorkflowStep, PromptBlock, CodeBlock, StepList, Checklist, YouTube, VideoEmbed, BeforeAfter, Gallery, Checkpoint, CheckItem, Resource, Milestone } from './mdx-components'
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
  YouTube,
  VideoEmbed,
  BeforeAfter,
  Gallery,
  // Track lesson components
  Checkpoint,
  CheckItem,
  Resource,
  Milestone,
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
          // next-mdx-remote v6 defaults blockJS:true which strips JS expressions
          // (array/object literals in JSX props) via removeJavaScriptExpressions.
          // Our MDX is author-controlled content — not user-submitted — so we
          // opt out of this restriction to allow prop values like items={[...]}
          blockJS: false,
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
