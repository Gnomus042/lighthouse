/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

declare module 'n3' {
    export class Parser {
        constructor(options: any);
        parse(nquads: any): Array<any>;
    }

    export class Store {
        addQuad(quad: any):null;
        getQuads(subject?: any, predicate?: any, object?: any):Array<any>;
    }
}