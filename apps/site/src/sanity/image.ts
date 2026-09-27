import {createImageUrlBuilder} from '@sanity/image-url'
import type {SanityImageSource} from '@sanity/image-url'
import {sanityClient} from './client'
const builder=createImageUrlBuilder(sanityClient)
export function imageUrl(source:SanityImageSource){return builder.image(source).auto('format').fit('max')}
