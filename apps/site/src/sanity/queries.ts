import {defineQuery} from 'next-sanity'
export const ARTICLES_QUERY=defineQuery(`*[_type == "article" && defined(slug.current)] | order(featured desc, publishedAt desc){_id,title,"slug":slug.current,excerpt,featured,publishedAt,coverImage,"author":author->{name,role},"categories":categories[]->{title,"slug":slug.current}}`)
export const ARTICLE_QUERY=defineQuery(`*[_type == "article" && slug.current == $slug][0]{_id,title,"slug":slug.current,excerpt,publishedAt,coverImage,body,seo,"author":author->{name,role,photo,bio},"categories":categories[]->{title,"slug":slug.current}}`)
