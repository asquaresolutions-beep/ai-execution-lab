import { MDXRemote } from 'next-mdx-remote/rsc'
import { mdxComponents } from './mdx-components'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

interface ContentRendererProps {
  source: string
}

export async function ContentRenderer({ source }: ContentRendererProps) {
  return (
    <div className="prose-lab">
      <MDXRemote
        source={source}
        components={mdxComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              rehypeSlug,
              [
                rehypeAutolinkHeadings,
                {
                  behavior: 'wrap',
                  properties: {
                    className: ['anchor'],
                  },
                },
              ],
            ],
          },
        }}
      />
    </div>
  )
}
