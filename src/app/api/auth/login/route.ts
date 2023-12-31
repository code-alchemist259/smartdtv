import { getElasticClient } from "@/data/elastic/elastic";
import { NextResponse } from "next/server";
import { cookies } from 'next/headers'
import { ZodError, z } from "zod";
import { first } from "lodash";
import { sign } from 'jsonwebtoken';
// import { zfd } from "zod-form-data";

import { ServerApiConstants } from "../../api.contants";
import { ApiConstants } from "@/data/api/api.constants";
import { ModelAuthLogin } from "@/types/auth/auth";
import { ElasticConstants } from "@/data/elastic/elastic.constants";
import { ModelElasticUser, ModelElasticUsersResult } from "@/types/elastic/users/users";

export async function POST(
    req: Request,
) {
    // const { q: query } = req.body;

    // const schema = zfd.formData({
    //     email: zfd.text(),
    //     password: zfd.text(),
    //     // likesPizza: zfd.checkbox(),
    // });

    // console.log("q: ", query) 

    // // validate the "q" query parameter exists and is a string
    // if (!query || typeof query !== 'string') {
    //   return res.status(400).end();
    // }

    const Schema = z.object({
        // username: z.string(),
        email: z.string(
            {
                required_error: "Reqire email",
                invalid_type_error: "Invalid email type"
            }
        ),
        password: z.string(),
    });

    var requestData = await req.json()

    var requestBody: ModelAuthLogin;
    try {
        requestBody = Schema.parse(requestData)

    } catch (err) {
        if (err instanceof ZodError) {

            let error = first(err.errors);

            return NextResponse.json({ message: error?.message }, {
                status: ApiConstants.httpError.badRequest
            });

        } else {
            return NextResponse.json({ message: err ?? 'invalid data unknown' }, {
                status: ApiConstants.httpError.badRequest
            });
        }

    }

    // const { email, password } = requestData;
    // const formData = await request.formData()
    // // const name = formData.get('name')
    // // const email = formData.get('email')
    // const email = formData.get('email')
    // const password = formData.get('password')
    const elastic = await getElasticClient();
    var response: ModelElasticUsersResult = {
        items: [],
        size: 0,
    }

    const result = await elastic.search({
        index: ElasticConstants.indexes.users._,
        body: {
            size: 1,
            query: {
                bool: {
                    must: [
                        {match: {"email": requestBody.email}},
                        {match: {"password": requestBody.password}}
                    ]
                },
            }
        }
    });
    response.items = (result.hits.hits).map(ele=> ele._source) as ModelElasticUser[];//?.result 
    response.size = ((result.hits.total  as any)?.[`value`] as number | undefined) ?? 0;//?.result 

    console.log(response.items, response.size, requestBody.email, requestBody.password);

    // var keys = Object.keys(ServerApiConstants.credentials)
    var keys = response.items;

    var index = keys.findIndex(item => item.email === requestBody.email)

    if (index < 0) {
        return NextResponse.json({ message: 'invalid email' }, {
            status: ApiConstants.httpError.badRequest
        });

    }

    // if ((ServerApiConstants.credentials as any)[requestBody.email] != requestBody.password) {
    //     return NextResponse.json({ message: 'invalid password' }, {
    //         status: ApiConstants.httpError.unauthorized
    //     });

    // }
    try {

        // if ()
        const cookieStore = cookies()
        // const token = cookieStore.get('token')

        const secretKey = ServerApiConstants.secret.token;
        const token = sign({ email: requestBody.email }, secretKey, {
            algorithm: "HS256",
        });

        console.log("result: ", token)

        // return NextResponse.json(tasks);
        return NextResponse.json({ isLoggedIn: true, token: token }, {
            status: 200,
            headers: {
                'Set-Cookie': `token=${token}`,
                
            },

        })

        // return new Response({ss:'Hello, Next.js!'}, {

        // })

    } catch (err) {

        return NextResponse.json({ message: err ?? 'failed to load data' }, {
            status: ApiConstants.httpError.internalServer
        });
        // res.status(500).json({ error: 'failed to load data' })
    }
}