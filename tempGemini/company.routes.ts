import type { CompanyEntity } from '@/domain/entities' // Import Company entity
import type { CompanyController } from '@/presentation/controllers'

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { container, TOKENS } from '@/infrastructure/container'

import {
  CompanyListSchema,
  CompanySchema,
  CreateCompanySchema,
  IdParamCompanySchema as IdParamSchema,
  ListCompanySchema,
  UpdateCompanySchema,
} from '@/presentation/schemas'

export const createCompanyRoutes = () => {
  const companyRouter = new OpenAPIHono()
  const compController = container.resolve<CompanyController>(TOKENS.CompanyController)

  companyRouter.onError((err, c) => {
    //console.error('⚠️ Erro capturado:', err)

    // Retorna sempre JSON com status adequado
    const message = err.message || 'Erro interno no servidor'

    return c.json(
      {
        error: message,
        // opcional: detalhar stack em dev
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
      500,
    )
  })

  // --- CREATE ---
  companyRouter.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Company'],
      operationId: 'companyCreate',
      summary: 'Create Company',
      request: {
        body: {
          content: {
            'application/json': {
              schema: CreateCompanySchema,
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Company created',
          content: { 'application/json': { schema: CompanySchema } },
        },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: z.object({ error: z.string() }) } },
        },
      },
    }),
    async (c) => {
      const body = await c.req.json()
      const result = await compController.createCompany(body)
      if (result.isFailure) return c.json({ error: result.error ?? 'Unknown error' }, 400)
      return c.json(result.getValue().toJson(), 201)
    },
  )

  // --- GET ---
  companyRouter.openapi(
    createRoute({
      method: 'get',
      path: '/{id}',
      tags: ['Company'],
      operationId: 'companyGet',
      summary: 'Get Single Company',
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: {
          description: 'Company found',
          content: {
            'application/json': {
              schema: CompanySchema,
            },
          },
        },
        404: {
          description: 'Company not found',
        },
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      const result = await compController.getCompany({ id })
      if (result.isFailure) return c.json({ error: result.error ?? 'Unknown error' }, 404)
      const entity = result.getValue()
      if (entity === null) return c.json({ success: true, entity: null })
      return c.json({ success: true, entity: entity.toJson() }, 200)
    },
  )

  // --- UPDATE ---
  companyRouter.openapi(
    createRoute({
      method: 'put',
      path: '/{id}',
      tags: ['Company'],
      operationId: 'companyUpdate',
      summary: 'Update Company',
      request: {
        params: IdParamSchema,
        body: {
          content: {
            'application/json': {
              schema: UpdateCompanySchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Company updated',
          content: {
            'application/json': {
              schema: CompanySchema,
            },
          },
        },
        404: {
          description: 'Company not found',
        },
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = await c.req.json()
      const result = await compController.updateCompany({ id, ...body })
      if (result.isFailure) return c.json({ error: result.error ?? 'Unknown error' }, 404)
      return c.json(result.getValue().toJson(), 200)
    },
  )

  // --- DELETE ---
  companyRouter.openapi(
    createRoute({
      method: 'delete',
      path: '/{id}',
      tags: ['Company'],
      operationId: 'companyDelete',
      summary: 'Delete Company',
      request: {
        params: IdParamSchema,
      },
      responses: {
        204: {
          description: 'Company deleted',
        },
        404: {
          description: 'Company not found',
        },
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      const result = await compController.deleteCompany({ id })
      if (result.isFailure) return c.json({ error: result.error ?? 'Unknown error' }, 404)
      return c.body(null, 204)
    },
  )

  // --- LIST ---
  companyRouter.openapi(
    createRoute({
      method: 'post',
      path: '/list',
      tags: ['Company'],
      operationId: 'companyList',
      summary: 'List Companies',
      request: {
        query: ListCompanySchema,
      },
      responses: {
        200: {
          description: 'Company listed',
          content: {
            'application/json': {
              schema: CompanyListSchema,
            },
          },
        },
        404: {
          description: 'Company not found',
        },
      },
    }),
    async (c) => {
      const query = ListCompanySchema.parse(c.req.query())

      const limit = query.limit ? parseInt(query.limit, 10) : undefined
      const offset = query.offset ? parseInt(query.offset, 10) : undefined
      const organizationId = query.organizationId
      const result = await compController.listCompany({
        organizationId,
        limit,
        offset,
        includeDeleted: false,
      })

      if (result.isFailure) {
        return c.json({ error: result.error ?? 'Unknown error' }, 404)
      }

      const output = result.getValue().map((entity: CompanyEntity) => entity.toJson())
      return c.json({ success: true, entities: output }, 200)
    },
  )
  return companyRouter
}
