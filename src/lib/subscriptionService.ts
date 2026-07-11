import api from './api';

export interface SubscriptionPackage {
  subscription_id: number;
  subscription_code: string;
  package_name: string;
  price: number;
  document_upload_limit: number;
  query_limit: number;
  workspaces: number;
  support: string;
  api_requests_limit: number;
  max_tokens: number;
  analytics: string;
  api_keys_limit: number;
  renewal_period: string;
  description: string;
}

export interface UserSubscription {
  subscription_id: string;
  subscription_package_code: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string;
  renewal_date: string;
  user_id: string;
  payment_transaction_id: string;
  analytics?: 'No' | 'Basic' | 'Advanced';
}

/** POST /subscription/get_all_plans */
export async function fetchAllPlans(): Promise<SubscriptionPackage[]> {
  const res = await api.post('/subscription/get_all_plans');
  return res.data ?? [];
}

/** POST /subscription/activate?subscription_plan_code={code}
 *  Auth: Bearer JWT (auto-attached by Axios interceptor — no user_id param needed).
 *  Returns Paddle transaction details to open the checkout overlay.
 */
export async function activatePlan(planCode: string): Promise<{
  message: string;
  paddle_transaction_id: string;
  plan_code: string;
  amount: number;
}> {
  const res = await api.post('/subscription/activate', null, {
    params: { subscription_plan_code: planCode },
  });
  return res.data;
}

/** POST /subscription/upgrade?new_plan_code={code}
 *  Auth: Bearer JWT
 *  Returns Paddle transaction details to open the checkout overlay for upgrading.
 */
export async function upgradePlan(newPlanCode: string): Promise<{
  message: string;
  paddle_transaction_id: string;
  current_plan_code: string;
  new_plan_code: string;
  amount: number;
}> {
  const res = await api.post('/subscription/upgrade', null, {
    params: { new_plan_code: newPlanCode },
  });
  return res.data;
}

/** POST /subscription/cancel  —  params: subscription_id */
export async function cancelSubscription(subscriptionId: string) {
  const res = await api.post('/subscription/cancel', null, {
    params: { subscription_id: subscriptionId },
  });
  return res.data as { message: string };
}

/** POST /subscription/renew  —  params: user_id */
export async function renewSubscription(userId: string) {
  const res = await api.post('/subscription/renew', null, {
    params: { user_id: userId },
  });
  return res.data as { message: string; subscription: UserSubscription };
}

/** POST /subscription/get_subscription_details  —  params: user_id */
export async function fetchSubscriptionDetails(userId: string): Promise<UserSubscription | null> {
  try {
    const res = await api.post('/subscription/get_subscription_details', null, {
      params: { user_id: userId },
      skipAuthRedirect: true, // background fetch — returns null on any error
    });
    return res.data?.subscription ?? null;
  } catch {
    return null; // 404 / 401 — no active subscription
  }
}

/** GET /subscription/subscriptions_status  —  params: user_id */
export async function checkSubscriptionStatus(userId: string): Promise<string | null> {
  try {
    const res = await api.get('/subscription/subscriptions_status', {
      params: { user_id: userId },
    });
    return res.data?.subscription ?? null;
  } catch {
    return null;
  }
}
