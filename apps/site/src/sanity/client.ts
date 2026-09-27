import {createClient} from 'next-sanity'
export const sanityClient=createClient({projectId:process.env.NEXT_PUBLIC_SANITY_PROJECT_ID||'ldflsbt7',dataset:process.env.NEXT_PUBLIC_SANITY_DATASET||'production',apiVersion:'2026-09-01',useCdn:false})
