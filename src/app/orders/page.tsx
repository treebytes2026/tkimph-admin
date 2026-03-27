"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Footer, Navbar, TopBanner } from "@/components/landing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCart } from "@/contexts/cart-context";
import { AUTH_CHANGED_EVENT, getStoredUser, type AuthUser } from "@/lib/auth";
import {
  CustomerApiError,
  createCustomerOrderIssue,
  fetchCustomerOrders,
  requestCustomerOrderCancel,
  submitCustomerOrderItemReview,
  submitCustomerOrderReview,
  type CustomerOrder,
} from "@/lib/customer-api";
import { publicFileUrl, type PublicMenuItem, type PublicRestaurant } from "@/lib/public-api";

function formatPhp(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPlacedAt(iso: string | null): string {
  if (!iso) return "Date unavailable";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "preparing":
      return "Preparing";
    case "out_for_delivery":
      return "Out for delivery";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    case "undeliverable":
      return "Undeliverable";
    default:
      return status;
  }
}

function orderStatusClass(status: string): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
    case "cancelled":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "accepted":
    case "preparing":
    case "out_for_delivery":
      return "border-primary/30 bg-primary/10 text-primary";
    case "pending":
    default:
      return "border-amber-500/35 bg-amber-500/10 text-amber-700";
  }
}

function orderItemImageUrl(item: CustomerOrder["items"][number]): string | null {
  return publicFileUrl(item.image_path, item.image_url);
}

export default function OrdersPage() {
  const router = useRouter();
  const { clearCart, registerCartRestaurant, setLineQuantity } = useCart();
  const [user, setUser] = useState<AuthUser | null>(null);
  const userId = user?.id ?? null;
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { rating: number; comment: string }>>({});
  const [itemReviewDrafts, setItemReviewDrafts] = useState<Record<string, { rating: number; comment: string }>>({});

  function statusSnapshotKey(id: number): string {
    return `tkimph:orders:status-snapshot:${id}`;
  }

  function unreadUpdatesKey(id: number): string {
    return `tkimph:orders:unread-updates:${id}`;
  }

  useEffect(() => {
    const applyAuth = () => {
      const u = getStoredUser();
      if (!u) {
        setUser(null);
        router.replace("/login");
        return;
      }
      if (u.role === "restaurant_owner") {
        router.replace("/partner/dashboard");
        return;
      }
      if (u.role === "admin") {
        router.replace("/dashboard");
        return;
      }
      setUser(u);
    };

    applyAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, applyAuth);
    window.addEventListener("storage", applyAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, applyAuth);
      window.removeEventListener("storage", applyAuth);
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadOrders(initial = false) {
      if (initial) setOrdersLoading(true);
      try {
        const res = await fetchCustomerOrders(20);
        if (cancelled) return;
        setOrders(res.data);
        setOrdersError(null);

        const nextSnapshot: Record<string, string> = {};
        for (const order of res.data) {
          const id = String(order.id);
          nextSnapshot[id] = order.status;
        }
        localStorage.setItem(statusSnapshotKey(userId), JSON.stringify(nextSnapshot));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof CustomerApiError && err.status === 401) {
          router.replace("/login");
        }
        setOrdersError(err instanceof Error ? err.message : "Could not load orders.");
      } finally {
        if (!cancelled && initial) setOrdersLoading(false);
      }
    }

    void loadOrders(true);
    const interval = window.setInterval(() => {
      void loadOrders(false);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userId, router]);

  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(unreadUpdatesKey(userId), JSON.stringify([]));
    window.dispatchEvent(new Event("tkimph:orders-unread-cleared"));
  }, [userId]);

  function buildReorderRestaurant(order: CustomerOrder): PublicRestaurant | null {
    if (!order.restaurant) return null;
    return {
      id: order.restaurant.id,
      name: order.restaurant.name,
      slug: order.restaurant.slug,
      description: null,
      address: order.restaurant.address,
      profile_image_path: order.restaurant.profile_image_path,
      profile_image_url: order.restaurant.profile_image_url,
      cuisine: null,
    };
  }

  function buildReorderMenuItem(item: CustomerOrder["items"][number]): PublicMenuItem | null {
    if (!item.menu_item_id) return null;
    return {
      id: item.menu_item_id,
      name: item.name,
      description: null,
      price: String(item.unit_price),
      image_path: item.image_path,
      image_url: item.image_url,
    };
  }

  function handleReorder(order: CustomerOrder) {
    const restaurant = buildReorderRestaurant(order);
    if (!restaurant) {
      setOrdersError("This order cannot be reordered because restaurant details are unavailable.");
      return;
    }

    const lines = order.items
      .map((item) => ({ item: buildReorderMenuItem(item), qty: item.quantity }))
      .filter((line): line is { item: PublicMenuItem; qty: number } => Boolean(line.item));

    if (lines.length === 0) {
      setOrdersError("This order has no available items to reorder.");
      return;
    }

    setReorderingId(order.id);
    clearCart();
    registerCartRestaurant(restaurant);
    for (const line of lines) {
      setLineQuantity(line.item, line.qty);
    }
    router.push("/checkout");
  }

  async function refreshOrdersSnapshot() {
    const res = await fetchCustomerOrders(20);
    setOrders(res.data);
  }

  async function handleCancelRequest(order: CustomerOrder) {
    const reason = window.prompt("Tell us why you want to cancel this order:");
    if (!reason?.trim()) return;
    setActionOrderId(order.id);
    try {
      await requestCustomerOrderCancel(order.id, reason.trim());
      await refreshOrdersSnapshot();
      setOrdersError(null);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Could not submit cancellation request.");
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleHelpIssue(order: CustomerOrder) {
    const description = window.prompt("Describe your issue so support can help:");
    if (!description?.trim()) return;
    setActionOrderId(order.id);
    try {
      await createCustomerOrderIssue(order.id, {
        issue_type: "help",
        subject: `Help needed for order #${order.order_number}`,
        description: description.trim(),
      });
      await refreshOrdersSnapshot();
      setOrdersError(null);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Could not submit support request.");
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleRefundRequest(order: CustomerOrder) {
    const description = window.prompt("Share refund details (what happened):");
    if (!description?.trim()) return;
    setActionOrderId(order.id);
    try {
      await createCustomerOrderIssue(order.id, {
        issue_type: "refund_request",
        subject: `Refund request for order #${order.order_number}`,
        description: description.trim(),
      });
      await refreshOrdersSnapshot();
      setOrdersError(null);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Could not submit refund request.");
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleReview(order: CustomerOrder) {
    const draft = reviewDrafts[order.id] ?? { rating: order.review?.restaurant_rating ?? 5, comment: order.review?.comment ?? "" };
    if (!draft.rating || draft.rating < 1 || draft.rating > 5) {
      setOrdersError("Please select a rating from 1 to 5 stars.");
      return;
    }
    setActionOrderId(order.id);
    try {
      await submitCustomerOrderReview(order.id, {
        restaurant_rating: Math.round(draft.rating),
        comment: draft.comment.trim() ? draft.comment.trim() : null,
      });
      await refreshOrdersSnapshot();
      setOrdersError(null);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Could not submit review.");
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleItemReview(order: CustomerOrder, item: CustomerOrder["items"][number]) {
    if (!item.menu_item_id) {
      setOrdersError("This dish can no longer be rated because it is no longer linked.");
      return;
    }
    const key = `${order.id}:${item.menu_item_id}`;
    const draft = itemReviewDrafts[key] ?? { rating: 5, comment: "" };
    if (!draft.rating || draft.rating < 1 || draft.rating > 5) {
      setOrdersError("Please select a dish rating from 1 to 5 stars.");
      return;
    }

    setActionOrderId(order.id);
    try {
      await submitCustomerOrderItemReview(order.id, {
        menu_item_id: item.menu_item_id,
        rating: draft.rating,
        comment: draft.comment.trim() ? draft.comment.trim() : null,
      });
      await refreshOrdersSnapshot();
      setOrdersError(null);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Could not submit dish review.");
    } finally {
      setActionOrderId(null);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/20">
        <TopBanner />
        <Navbar />
        <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:py-10">
        <div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">Track status updates and reorder anytime.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order history</CardTitle>
            <CardDescription>Latest updates refresh automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ordersLoading ? (
              <p className="text-sm text-muted-foreground">Loading your orders...</p>
            ) : orders.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                No orders yet. Place your first order from a restaurant menu.
              </p>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-border/80 bg-background p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          #{order.order_number} - {order.restaurant?.name ?? "Restaurant"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatPlacedAt(order.placed_at)}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${orderStatusClass(order.status)}`}
                      >
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="text-muted-foreground">
                        {order.items.reduce((sum, line) => sum + line.quantity, 0)} items
                      </p>
                      <p className="font-semibold text-foreground">{formatPhp(order.total)}</p>
                    </div>
                    <div className="mt-4 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                      {order.items.map((item) => {
                        const imageUrl = orderItemImageUrl(item);
                        const itemKey = `${order.id}:${item.menu_item_id ?? item.id}`;
                        const itemDraft = itemReviewDrafts[itemKey] ?? { rating: 5, comment: "" };
                        return (
                          <div key={item.id} className="rounded-lg bg-background/80 px-2 py-2">
                            <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted text-xs font-semibold text-muted-foreground">
                              {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={imageUrl}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span>Item</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} x {formatPhp(item.unit_price)}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{formatPhp(item.line_total)}</p>
                            </div>
                            {order.status === "completed" && item.menu_item_id ? (
                              <div className="mt-2 rounded-md border border-border/60 bg-muted/10 p-2">
                                <p className="text-[11px] font-semibold text-foreground">Rate this dish</p>
                                <div className="mt-1 flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      className={`text-base leading-none ${star <= itemDraft.rating ? "text-amber-500" : "text-muted-foreground"}`}
                                      onClick={() =>
                                        setItemReviewDrafts((prev) => ({
                                          ...prev,
                                          [itemKey]: {
                                            rating: star,
                                            comment: prev[itemKey]?.comment ?? "",
                                          },
                                        }))
                                      }
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  className="mt-1 min-h-14 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                                  placeholder="Optional feedback for this dish"
                                  value={itemDraft.comment}
                                  onChange={(e) =>
                                    setItemReviewDrafts((prev) => ({
                                      ...prev,
                                      [itemKey]: {
                                        rating: prev[itemKey]?.rating ?? 5,
                                        comment: e.target.value,
                                      },
                                    }))
                                  }
                                />
                                <div className="mt-1 flex justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void handleItemReview(order, item)}
                                    disabled={actionOrderId === order.id}
                                  >
                                    {actionOrderId === order.id ? "Submitting..." : "Submit dish rating"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {order.customer_cancel_eligible ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleCancelRequest(order)}
                          disabled={actionOrderId === order.id}
                        >
                          {actionOrderId === order.id ? "Submitting..." : "Request cancel"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleHelpIssue(order)}
                        disabled={actionOrderId === order.id}
                      >
                        {actionOrderId === order.id ? "Submitting..." : "Help / dispute"}
                      </Button>
                      {order.payment_status === "paid" &&
                      ["cancelled", "failed", "undeliverable"].includes(order.status) ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRefundRequest(order)}
                          disabled={actionOrderId === order.id}
                        >
                          {actionOrderId === order.id ? "Submitting..." : "Request refund"}
                        </Button>
                      ) : null}
                      {order.status === "completed" ? (
                        <div className="w-full rounded-lg border border-border/70 bg-muted/20 p-3 sm:w-auto sm:min-w-[330px]">
                          <p className="text-xs font-semibold text-foreground">
                            {order.review ? "Update restaurant rating" : "Rate the restaurant"}
                          </p>
                          <div className="mt-2 flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const draft = reviewDrafts[order.id];
                              const selected = draft?.rating ?? order.review?.restaurant_rating ?? 0;
                              const active = star <= selected;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  className={`text-lg leading-none ${active ? "text-amber-500" : "text-muted-foreground"}`}
                                  onClick={() =>
                                    setReviewDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        rating: star,
                                        comment: prev[order.id]?.comment ?? order.review?.comment ?? "",
                                      },
                                    }))
                                  }
                                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                                >
                                  ★
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            className="mt-2 min-h-16 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                            placeholder="Share your feedback (optional)"
                            value={reviewDrafts[order.id]?.comment ?? order.review?.comment ?? ""}
                            onChange={(e) =>
                              setReviewDrafts((prev) => ({
                                ...prev,
                                [order.id]: {
                                  rating: prev[order.id]?.rating ?? order.review?.restaurant_rating ?? 5,
                                  comment: e.target.value,
                                },
                              }))
                            }
                          />
                          <div className="mt-2 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleReview(order)}
                              disabled={actionOrderId === order.id}
                            >
                              {actionOrderId === order.id ? "Submitting..." : order.review ? "Update review" : "Submit review"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleReorder(order)}
                        disabled={reorderingId === order.id}
                      >
                        {reorderingId === order.id ? "Reordering..." : "Reorder"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ordersError ? <p className="text-sm text-destructive">{ordersError}</p> : null}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
