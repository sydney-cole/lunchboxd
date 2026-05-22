import { ReviewComposer } from '@/components/review-composer'

interface Props {
  searchParams: Promise<{ restaurantId?: string; restaurantName?: string }>
}

export default async function NewReviewPage({ searchParams }: Props) {
  const { restaurantId, restaurantName } = await searchParams
  const initialData =
    restaurantId ? { restaurantId, restaurantName: restaurantName ?? '' } : undefined
  return <ReviewComposer mode="create" initialData={initialData} />
}
