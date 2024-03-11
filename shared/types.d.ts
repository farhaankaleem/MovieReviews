
export type MovieReviews = {
  movieId: number;
  reviewerName: string;
  reviewDate: string;
  content: string;
  rating: number;
};

// Used to validate the query string og HTTP Get requests
export type MovieReviewQueryParams = {
  minRating?: string;
  language?: string;
}
 
// Used to validate the body string og HTTP Put requests
export type MovieReviewEdit = {
  content?: string;
}

export type SignUpBody = {
  username: string;
  password: string;
  email: string
}

export type ConfirmSignUpBody = {
  username: string;
  code: string;
}

export type SignInBody = {
  username: string;
  password: string;
}