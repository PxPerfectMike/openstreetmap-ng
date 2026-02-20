import { create } from "@bufbuild/protobuf"
import {
  API_URL,
  config,
  OAUTH_APP_NAME_MAX_LENGTH,
  OAUTH_PAT_NAME_MAX_LENGTH,
} from "@lib/config"
import { CopyButton } from "@lib/copy-group"
import { Time } from "@lib/datetime-inputs"
import { tRich } from "@lib/i18n"
import {
  type AdminPage_EntryValid,
  AdminPageSchema,
  type AuthorizationsPage_EntryValid,
  AuthorizationsPageSchema,
  Service,
  TokensPage_TokenSchema,
  type TokensPage_TokenValid,
  TokensPageSchema,
} from "@lib/proto/settings_applications_pb"
import { Service as SecurityService } from "@lib/proto/settings_security_pb"
import { Scope } from "@lib/proto/shared_pb"
import { mountProtoPage } from "@lib/proto-page"
import { ReportButton } from "@lib/report"
import { formDataScopes, SCOPE_LABEL, SCOPES_NO_WEB_USER, ScopeList } from "@lib/scope"
import { StandardForm } from "@lib/standard-form"
import { headersDate, throwAbortError } from "@lib/utils"
import { useSignal, useSignalEffect } from "@preact/signals"
import { t } from "i18next"
import type { ComponentChildren, TargetedMouseEvent } from "preact"
import { useRef } from "preact/hooks"
import { SettingsNav } from "../_nav"
import { SettingsApplicationsNav } from "./_nav"

const SYSTEM_APP_WEB_CLIENT_ID = "SystemApp.web"
const API_DOMAIN = new URL(API_URL).host

const toggleBigintSet = (current: Set<bigint>, id: bigint) => {
  const next = new Set(current)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

const ApplicationsLayout = ({
  title,
  children,
}: {
  title: string
  children: ComponentChildren
}) => (
  <>
    <div class="content-header">
      <h1 class="container">{title}</h1>
    </div>

    <div class="content-body">
      <div class="container">
        <div class="row">
          <div class="col-lg-auto mb-4">
            <SettingsNav />
          </div>

          <div class="col-lg">{children}</div>
        </div>
      </div>
    </div>
  </>
)

const AuthorizationsOwnerInfo = ({
  entry,
}: {
  entry: AuthorizationsPage_EntryValid
}) => {
  const owner = entry.application.owner

  if (owner?.id === config.userConfig!.user.id) {
    return (
      <>
        <i class="bi bi-person-fill text-primary" /> {t("settings.owned_by_you")}
      </>
    )
  }

  if (!owner) {
    return (
      <>
        <i class="bi bi-shield-fill-check text-success" />{" "}
        {tRich("settings.owned_by_user", {
          name: <a href="/">{t("project_name")}</a>,
        })}
      </>
    )
  }

  return tRich("settings.owned_by_user", {
    name: (
      <a href={`/user/${owner.displayName}`}>
        <img
          class="avatar me-1"
          src={owner.avatarUrl}
          alt={t("alt.profile_picture")}
          loading="lazy"
        />
        {owner.displayName}
      </a>
    ),
  })
}

const AuthorizationEntry = ({
  entry,
  expanded,
  onToggle,
  onRevoke,
}: {
  entry: AuthorizationsPage_EntryValid
  expanded: boolean
  onToggle: () => void
  onRevoke: () => void
}) => {
  const { application } = entry
  const canRevoke = application.clientId !== SYSTEM_APP_WEB_CLIENT_ID
  const canReport = Boolean(application.owner)
  const onHeaderClick = (event: TargetedMouseEvent<HTMLButtonElement>) => {
    if ((event.target as Element).closest("a")) return
    onToggle()
  }

  return (
    <div class="accordion">
      <div class="accordion-header">
        <button
          class={`accordion-button ${expanded ? "" : "collapsed"}`}
          type="button"
          aria-expanded={expanded}
          onClick={onHeaderClick}
        >
          <div class="row align-items-center g-3 g-lg-4">
            <div class="col-auto">
              <img
                class="app-avatar avatar"
                src={application.avatarUrl}
                alt={t("alt.application_image")}
                loading="lazy"
              />
            </div>
            <div class="col">
              <h6 class="mb-1">{application.name}</h6>
              <p class="form-text mb-0">
                {tRich("settings.authorized_at", {
                  date: (
                    <>
                      <Time
                        class="fw-medium"
                        unix={entry.authorizedAt}
                        dateStyle="long"
                        timeStyle="short"
                      />{" "}
                      (
                      <Time
                        unix={entry.authorizedAt}
                        relativeStyle="long"
                      />
                      )
                    </>
                  ),
                })}
                <br />
                <AuthorizationsOwnerInfo entry={entry} />
              </p>
            </div>
          </div>
        </button>
      </div>

      <div class={`accordion-collapse collapse ${expanded ? "show" : ""}`}>
        <div class="accordion-body">
          <div class="row g-3 g-md-2">
            <div class="col-md">
              <h6>{t("settings.requested_permissions")}</h6>
              <ScopeList scopes={application.scopes} />
            </div>

            {canRevoke && (
              <div class="col-md-auto align-self-end text-end">
                <StandardForm
                  class={canReport ? "btn-group" : ""}
                  method={Service.method.revokeAuthorization}
                  buildRequest={() => ({ id: application.id })}
                  onSuccess={onRevoke}
                >
                  <button
                    class="btn btn-soft"
                    type="submit"
                  >
                    {t("action.revoke_access")}
                  </button>

                  {canReport && (
                    <>
                      <button
                        class="btn btn-soft dropdown-toggle dropdown-toggle-split"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded={false}
                        aria-label={t("action.show_more")}
                      />
                      <ul class="dropdown-menu">
                        <li>
                          <ReportButton
                            class="dropdown-item"
                            reportType="user"
                            reportTypeId={application.owner!.id}
                            reportAction="user_oauth2_application"
                            reportActionId={application.id}
                          >
                            {t("report.report_object", {
                              object: t(
                                "oauth2_authorized_applications.index.application",
                              ),
                            })}
                          </ReportButton>
                        </li>
                      </ul>
                    </>
                  )}
                </StandardForm>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const AdminEntry = ({
  entry,
  expanded,
  onToggle,
}: {
  entry: AdminPage_EntryValid
  expanded: boolean
  onToggle: () => void
}) => (
  <div class="accordion">
    <div class="accordion-header">
      <button
        class={`accordion-button ${expanded ? "" : "collapsed"}`}
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <div class="row align-items-center g-3 g-lg-4">
          <div class="col-auto">
            <img
              class="app-avatar avatar"
              src={entry.avatarUrl}
              alt={t("alt.application_image")}
              loading="lazy"
            />
          </div>
          <div class="col">
            <h6 class="mb-1">{entry.name}</h6>
            <p class="form-text mb-0">
              {tRich("settings.created_at", {
                date: (
                  <>
                    <Time
                      class="fw-medium"
                      unix={entry.createdAt}
                      dateStyle="long"
                      timeStyle="short"
                    />{" "}
                    (
                    <Time
                      unix={entry.createdAt}
                      relativeStyle="long"
                    />
                    )
                  </>
                ),
              })}
              <br />
              <i class="bi bi-person-fill text-primary" /> {t("settings.owned_by_you")}
            </p>
          </div>
        </div>
      </button>
    </div>

    <div class={`accordion-collapse collapse ${expanded ? "show" : ""}`}>
      <div class="accordion-body">
        <div class="row g-3 g-md-2">
          <div class="col-md">
            <h6>{t("settings.requested_permissions")}</h6>
            <ScopeList scopes={entry.scopes} />
          </div>

          <div class="col-md-auto align-self-end text-end">
            <a
              class="btn btn-soft"
              href={`/settings/applications/admin/${entry.id}/edit`}
            >
              {t("layouts.edit")}
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
)

type TokenState = TokensPage_TokenValid & {
  secret?: string
}

const TokenEntry = ({
  token,
  expanded,
  onToggle,
  onSecret,
  onRevoke,
}: {
  token: TokenState
  expanded: boolean
  onToggle: () => void
  onSecret: (secret: string, authorizedAt: bigint) => void
  onRevoke: () => void
}) => {
  const authorizedAt = token.authorizedAt
  const tokenValue =
    token.secret ?? (token.tokenPreview ? `${token.tokenPreview}...` : "")

  return (
    <div class="accordion">
      <div class="accordion-header">
        <button
          class={`accordion-button ${expanded ? "" : "collapsed"}`}
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <div class="row align-items-center g-3 g-lg-4">
            <div class="col-auto">
              <i class={`token-icon bi bi-key${authorizedAt ? "-fill" : ""}`} />
            </div>
            <div class="col">
              <h6 class="mb-1">{token.name}</h6>
              <p class="form-text mb-0">
                {authorizedAt
                  ? tRich("settings.updated_at", {
                      date: (
                        <>
                          <Time
                            class="fw-medium"
                            unix={authorizedAt}
                            dateStyle="long"
                            timeStyle="short"
                          />{" "}
                          (
                          <Time
                            unix={authorizedAt}
                            relativeStyle="long"
                          />
                          )
                        </>
                      ),
                    })
                  : tRich("settings.created_at", {
                      date: (
                        <>
                          <Time
                            class="fw-medium"
                            unix={token.createdAt}
                            dateStyle="long"
                            timeStyle="short"
                          />{" "}
                          (
                          <Time
                            unix={token.createdAt}
                            relativeStyle="long"
                          />
                          )
                        </>
                      ),
                    })}
              </p>
            </div>
          </div>
        </button>
      </div>

      <div class={`accordion-collapse collapse ${expanded ? "show" : ""}`}>
        <div class="accordion-body">
          <StandardForm
            method={Service.method.resetAccessToken}
            buildRequest={() => {
              if (!confirm(t("settings.new_secret_question"))) {
                throwAbortError()
              }
              return { tokenId: token.id }
            }}
            onSuccess={(resp, ctx) => onSecret(resp.secret, headersDate(ctx.headers))}
          >
            <label class="w-100 mb-3">
              <span class="h6">{t("settings.access_token")}</span>
              <div class="input-group mt-2">
                <input
                  type="text"
                  class="form-control font-monospace bg-body-tertiary"
                  value={tokenValue}
                  readOnly
                />
                <button
                  class="btn btn-soft"
                  type="submit"
                >
                  <i class="bi bi-arrow-clockwise" /> {t("settings.new_access_token")}
                </button>
                <CopyButton
                  class="btn btn-primary"
                  title={t("action.copy")}
                  getText={() => tokenValue}
                />
              </div>
            </label>
          </StandardForm>

          <div class="row g-3 g-md-2">
            <div class="col-md">
              <h6>{t("settings.requested_permissions")}</h6>
              <ScopeList scopes={token.scopes} />
            </div>

            <div class="col-md-auto align-self-end text-end">
              <StandardForm
                method={SecurityService.method.revokeToken}
                buildRequest={() => ({ tokenId: token.id })}
                onSuccess={onRevoke}
              >
                <button
                  class="btn btn-soft"
                  type="submit"
                >
                  {t("action.revoke_key")}
                </button>
              </StandardForm>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

mountProtoPage(AuthorizationsPageSchema, ({ entries: initialEntries }) => {
  const entries = useSignal(initialEntries)
  const expandedIds = useSignal<Set<bigint>>(new Set())
  const toggleExpanded = (id: bigint) =>
    (expandedIds.value = toggleBigintSet(expandedIds.value, id))

  return (
    <ApplicationsLayout title={t("settings.applications")}>
      <SettingsApplicationsNav />

      <p>{t("settings.authorizations.description")}</p>
      <ul class="applications-list list-unstyled">
        {entries.value.map((entry) => {
          const id = entry.application.id
          return (
            <li key={id}>
              <AuthorizationEntry
                entry={entry}
                expanded={expandedIds.value.has(id)}
                onToggle={() => toggleExpanded(id)}
                onRevoke={() =>
                  (entries.value = entries.value.filter(
                    (candidate) => candidate.application.id !== id,
                  ))
                }
              />
            </li>
          )
        })}
      </ul>
    </ApplicationsLayout>
  )
})

mountProtoPage(AdminPageSchema, ({ entries: initialEntries }) => {
  const entries = useSignal(initialEntries)
  const expandedIds = useSignal<Set<bigint>>(new Set())
  const showCreateForm = useSignal(false)
  const createNameInputRef = useRef<HTMLInputElement>(null)

  useSignalEffect(() => {
    if (showCreateForm.value) {
      createNameInputRef.current!.focus()
    }
  })

  const toggleExpanded = (id: bigint) =>
    (expandedIds.value = toggleBigintSet(expandedIds.value, id))

  return (
    <ApplicationsLayout title={t("settings.applications")}>
      <SettingsApplicationsNav />

      <p>{t("settings.my_applications.description")}</p>
      <ul class="applications-list list-unstyled">
        {entries.value.map((entry) => (
          <li key={entry.id}>
            <AdminEntry
              entry={entry}
              expanded={expandedIds.value.has(entry.id)}
              onToggle={() => toggleExpanded(entry.id)}
            />
          </li>
        ))}
      </ul>
      {entries.value.length === 0 && (
        <p class="form-text">
          <i class="bi bi-info-circle me-2" />
          {t("settings.my_applications.you_have_not_registered_any_applications_yet")}
        </p>
      )}

      <div class="d-flex justify-content-end mb-2">
        {!showCreateForm.value ? (
          <button
            class="btn btn-primary"
            type="button"
            onClick={() => (showCreateForm.value = true)}
          >
            <i class="bi bi-plus-lg" /> {t("settings.my_applications.new_application")}
          </button>
        ) : (
          <StandardForm
            class="d-flex"
            method={Service.method.create}
            buildRequest={({ formData }) => ({
              name: formData.get("name") as string,
            })}
            onSuccess={(resp) => {
              window.location.href = `/settings/applications/admin/${resp.id}/edit`
            }}
          >
            <input
              type="text"
              class="form-control me-2"
              name="name"
              placeholder={t("settings.name")}
              maxLength={OAUTH_APP_NAME_MAX_LENGTH}
              autoComplete="off"
              required
              ref={createNameInputRef}
            />
            <button
              class="btn btn-primary"
              type="submit"
            >
              {t("action.submit")}
            </button>
          </StandardForm>
        )}
      </div>
    </ApplicationsLayout>
  )
})

mountProtoPage(TokensPageSchema, ({ tokens: initialTokens, expandedTokenId }) => {
  const tokens = useSignal<TokenState[]>(initialTokens)
  const expandedIds = useSignal<Set<bigint>>(
    new Set(expandedTokenId ? [expandedTokenId] : []),
  )
  const showCreateForm = useSignal(false)
  const toggleExpanded = (id: bigint) =>
    (expandedIds.value = toggleBigintSet(expandedIds.value, id))

  return (
    <ApplicationsLayout title={t("settings.applications")}>
      <SettingsApplicationsNav />

      <p>{t("settings.my_tokens.description")}</p>
      <ul class="applications-list list-unstyled">
        {tokens.value.map((token) => (
          <li key={token.id}>
            <TokenEntry
              token={token}
              expanded={expandedIds.value.has(token.id)}
              onToggle={() => toggleExpanded(token.id)}
              onSecret={(secret, authorizedAt) =>
                (tokens.value = tokens.value.map((candidate) =>
                  candidate.id === token.id
                    ? ((candidate.secret = secret),
                      (candidate.authorizedAt = authorizedAt),
                      candidate)
                    : candidate,
                ))
              }
              onRevoke={() =>
                (tokens.value = tokens.value.filter(
                  (candidate) => candidate.id !== token.id,
                ))
              }
            />
          </li>
        ))}
      </ul>
      {tokens.value.length === 0 && (
        <p class="form-text">
          <i class="bi bi-info-circle me-2" />
          {t("settings.my_tokens.you_have_not_created_any_tokens_yet")}
        </p>
      )}

      <div class="accordion mb-4">
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button
              class={`accordion-button ${showCreateForm.value ? "" : "collapsed"}`}
              type="button"
              aria-expanded={showCreateForm.value}
              onClick={() => (showCreateForm.value = !showCreateForm.value)}
            >
              {t("settings.my_tokens.create_a_new_token")}
            </button>
          </h2>

          {showCreateForm.value && (
            <div class="accordion-collapse collapse show">
              <div class="accordion-body">
                <StandardForm
                  method={Service.method.createToken}
                  buildRequest={({ formData }) => ({
                    name: formData.get("name") as string,
                    scopes: formDataScopes(formData),
                  })}
                  onSuccess={(resp, ctx) => {
                    const token: TokenState = create(TokensPage_TokenSchema, {
                      id: resp.id,
                      name: ctx.request.name,
                      createdAt: headersDate(ctx.headers),
                      scopes: ctx.request.scopes,
                    })
                    tokens.value = [token, ...tokens.value]
                    expandedIds.value = new Set([token.id])
                    showCreateForm.value = false
                  }}
                  resetOnSuccess
                >
                  <label class="form-label d-block">
                    <span class="required">{t("settings.name")}</span>
                    <input
                      type="text"
                      class="form-control mt-2"
                      name="name"
                      maxLength={OAUTH_PAT_NAME_MAX_LENGTH}
                      required
                    />
                  </label>
                  <p class="form-text mb-3">{t("settings.my_tokens.name_hint")}</p>

                  <p class="form-label">{t("settings.requested_permissions")}</p>
                  <ul class="list-unstyled ms-1">
                    {SCOPES_NO_WEB_USER.map((scope) => (
                      <li
                        class="form-check"
                        key={scope}
                      >
                        <label class="form-check-label d-block">
                          <input
                            class="form-check-input"
                            type="checkbox"
                            name="scopes"
                            value={scope}
                          />
                          {SCOPE_LABEL[scope]}{" "}
                          <span class="scope">({Scope[scope]})</span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <div class="text-end">
                    <button
                      type="submit"
                      class="btn btn-primary"
                    >
                      {t("action.submit")}
                    </button>
                  </div>
                </StandardForm>
              </div>
            </div>
          )}
        </div>
      </div>

      <hr class="my-4" />

      <h3>{t("settings.my_tokens.how_to_use.title")}</h3>
      <p>{t("settings.my_tokens.how_to_use.description")}</p>
      <div class="card mb-3">
        <div class="card-header">
          <i class="bi bi-globe2 me-2" />
          {t("settings.my_tokens.how_to_use.example_http_request")}
        </div>
        <div class="card-body">
          <pre class="mb-0">
            <code>{`GET /api/0.7/user/details HTTP/1.1\nHost: ${API_DOMAIN}\nAuthorization: Bearer your_access_token_here`}</code>
          </pre>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <i class="bi bi-terminal me-2" />
          {t("settings.my_tokens.how_to_use.example_curl_command")}
        </div>
        <div class="card-body">
          <pre class="mb-0">
            <code>{`curl -H "Authorization: Bearer your_access_token_here" \\\n    ${API_URL}/api/0.7/user/details`}</code>
          </pre>
        </div>
      </div>
    </ApplicationsLayout>
  )
})
