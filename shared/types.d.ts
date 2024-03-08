
export type MovieReviews = {
  movieId: number;
  reviewerName: string;
  reviewDate: string;
  content: string;
  rating: number;
};

// Used to validate the query string og HTTP Get requests
export type MovieReviewQueryParams = {
  movieId: string;
  reviewerName?: string;
  reviewDate?: string;
  content?: string;
  rating?: number;
}
 