package expo.modules.playuserchoice

import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicReference

/**
 * Google Play User Choice Billing bridge.
 *
 * India User Choice: Google Play vs alternative billing (Razorpay Payment Link).
 * Product type is one-time INAPP (lifetime premium_unlock), not subscriptions.
 */
class PlayUserChoiceModule : Module() {
  private var billingClient: BillingClient? = null
  private val pendingPromise = AtomicReference<Promise?>(null)
  private var pendingProductId: String = ""

  override fun definition() = ModuleDefinition {
    Name("PlayUserChoice")

    Function("isAvailable") {
      true
    }

    AsyncFunction("launchUserChoiceBilling") { productId: String, offerToken: String?, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(mapOf("outcome" to "unavailable"))
        return@AsyncFunction
      }

      pendingProductId = productId
      pendingPromise.set(promise)

      val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        val p = pendingPromise.getAndSet(null) ?: return@PurchasesUpdatedListener
        when (result.responseCode) {
          BillingClient.BillingResponseCode.USER_CANCELED -> {
            p.resolve(mapOf("outcome" to "cancelled"))
          }
          BillingClient.BillingResponseCode.OK -> {
            var purchaseToken: String? = null
            purchases?.forEach { purchase ->
              if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                purchaseToken = purchase.purchaseToken
                if (!purchase.isAcknowledged) {
                  val params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
                  billingClient?.acknowledgePurchase(params) { }
                }
              }
            }
            if (purchaseToken != null) {
              p.resolve(
                mapOf(
                  "outcome" to "play_billing",
                  "purchaseToken" to purchaseToken,
                  "productId" to pendingProductId
                )
              )
            } else {
              p.resolve(mapOf("outcome" to "unavailable"))
            }
          }
          else -> {
            p.resolve(
              mapOf(
                "outcome" to "unavailable",
                "code" to result.responseCode
              )
            )
          }
        }
      }

      val client = BillingClient.newBuilder(activity)
        .setListener(purchasesListener)
        .enablePendingPurchases(
          PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
        )
        .enableAutoServiceReconnection()
        .enableUserChoiceBilling { userChoiceDetails ->
          val token = userChoiceDetails.externalTransactionToken
          val p = pendingPromise.getAndSet(null)
          p?.resolve(
            mapOf(
              "outcome" to "alternative_billing",
              "externalTransactionToken" to token
            )
          )
        }
        .build()

      billingClient = client

      client.startConnection(object : BillingClientStateListener {
        override fun onBillingSetupFinished(billingResult: BillingResult) {
          if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
            pendingPromise.getAndSet(null)?.resolve(mapOf("outcome" to "unavailable"))
            return
          }

          val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
              .setProductId(productId)
              .setProductType(BillingClient.ProductType.SUBS)
              .build()
          )
          val params = QueryProductDetailsParams.newBuilder().setProductList(productList).build()

          // PBL 8+: callback returns QueryProductDetailsResult (fetched + unfetched lists).
          client.queryProductDetailsAsync(params) { detailsResult, queryProductDetailsResult ->
            val productDetailsList = queryProductDetailsResult.productDetailsList
            if (detailsResult.responseCode != BillingClient.BillingResponseCode.OK ||
              productDetailsList.isEmpty()
            ) {
              pendingPromise.getAndSet(null)?.resolve(mapOf("outcome" to "unavailable"))
              return@queryProductDetailsAsync
            }

            val productDetails: ProductDetails = productDetailsList[0]
            val offerDetails = productDetails.subscriptionOfferDetails
            val token = offerToken
              ?: offerDetails?.firstOrNull()?.offerToken
            if (token == null) {
              pendingPromise.getAndSet(null)?.resolve(mapOf("outcome" to "unavailable"))
              return@queryProductDetailsAsync
            }

            val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
              .setProductDetails(productDetails)
              .setOfferToken(token)
              .build()

            val flowParams = BillingFlowParams.newBuilder()
              .setProductDetailsParamsList(listOf(productDetailsParams))
              .build()

            val launchResult = client.launchBillingFlow(activity, flowParams)
            if (launchResult.responseCode != BillingClient.BillingResponseCode.OK) {
              pendingPromise.getAndSet(null)?.resolve(mapOf("outcome" to "cancelled"))
            }
          }
        }

        override fun onBillingServiceDisconnected() {
          // no-op; enableAutoServiceReconnection handles transient disconnects
        }
      })
    }

    OnDestroy {
      billingClient?.endConnection()
      billingClient = null
    }
  }
}
