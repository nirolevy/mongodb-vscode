import * as vscode from 'vscode';
import { ObjectId } from 'bson';
import { afterEach, beforeEach } from 'mocha';
import assert from 'assert';
import { DataService } from 'mongodb-data-service';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';
import type {
  Document,
  Filter,
  FindOneAndReplaceOptions,
  DeleteOptions,
} from 'mongodb';

import {
  CollectionTreeItem,
  CollectionTypes,
  ConnectionTreeItem,
  DatabaseTreeItem,
  DocumentTreeItem,
  SchemaTreeItem,
} from '../../explorer';
import EXTENSION_COMMANDS from '../../commands';
import FieldTreeItem from '../../explorer/fieldTreeItem';
import IndexListTreeItem from '../../explorer/indexListTreeItem';
import { mdbTestExtension } from './stubbableMdbExtension';
import { mockTextEditor } from './stubs';
import {
  StorageLocation,
  StorageVariables,
} from '../../storage/storageController';
import { VIEW_COLLECTION_SCHEME } from '../../editors/collectionDocumentsProvider';

const testDatabaseURI = 'mongodb://localhost:27018';

suite('MDBExtensionController Test Suite', function () {
  this.timeout(10000);

  suite('when not connected', () => {
    let showErrorMessageStub: SinonSpy;
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
      sandbox.stub(vscode.window, 'showInformationMessage');
      sandbox.stub(vscode.workspace, 'openTextDocument');
      sandbox.stub(vscode.window, 'showTextDocument');
      showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('mdb.addDatabase command fails when not connected to the connection', async () => {
      const testTreeItem = new ConnectionTreeItem(
        'tasty_sandwhich',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      const addDatabaseSucceeded = await vscode.commands.executeCommand(
        'mdb.addDatabase',
        testTreeItem
      );
      assert(
        addDatabaseSucceeded === false,
        'Expected the command handler to return a false succeeded response'
      );

      const expectedMessage =
        'Please connect to this connection before adding a database.';
      assert(
        showErrorMessageStub.firstCall.args[0] === expectedMessage,
        `Expected an error message "${expectedMessage}" to be shown when attempting to add a database to a not connected connection found "${showErrorMessageStub.firstCall.args[0]}"`
      );
    });
  });

  suite('when connected', () => {
    let showInformationMessageStub: SinonStub;
    let openTextDocumentStub: SinonStub;
    let fakeActiveConnectionId: SinonSpy;
    let showErrorMessageStub: SinonStub;
    let fakeCreatePlaygroundFileWithContent: SinonSpy;

    const sandbox = sinon.createSandbox();

    beforeEach(() => {
      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
      openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
      fakeActiveConnectionId = sandbox.fake.returns('tasty_sandwhich');
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveConnectionId',
        fakeActiveConnectionId
      );
      fakeCreatePlaygroundFileWithContent = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        '_createPlaygroundFileWithContent',
        fakeCreatePlaygroundFileWithContent
      );
      showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
      sandbox.stub(vscode.window, 'showTextDocument');
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', async () => {
      const textCollectionTree = new CollectionTreeItem(
        {
          name: 'testColName',
          type: CollectionTypes.collection,
        },
        'testDbName',
        {},
        false,
        false,
        null
      );
      await vscode.commands.executeCommand(
        'mdb.viewCollectionDocuments',
        textCollectionTree
      );
      assert.strictEqual(
        openTextDocumentStub.firstCall.args[0].path.indexOf(
          'Results: testDbName.testColName'
        ),
        0
      );
      assert(openTextDocumentStub.firstCall.args[0].path.includes('.json'));
      assert.strictEqual(
        openTextDocumentStub.firstCall.args[0].scheme,
        VIEW_COLLECTION_SCHEME
      );
      assert(
        openTextDocumentStub.firstCall.args[0].query.includes(
          'namespace=testDbName.testColName'
        )
      );
    });

    test('mdb.viewCollectionDocuments command should also work with the documents list', async () => {
      const textCollectionTree = new CollectionTreeItem(
        {
          name: 'testColName',
          type: CollectionTypes.collection,
        },
        'testDbName',
        {},
        false,
        false,
        null
      );
      await vscode.commands.executeCommand(
        'mdb.viewCollectionDocuments',
        textCollectionTree
      );
      assert.strictEqual(
        openTextDocumentStub.firstCall.args[0].path.indexOf(
          'Results: testDbName.testColName'
        ),
        0
      );
      assert(openTextDocumentStub.firstCall.args[0].path.includes('.json'));
      assert.strictEqual(
        openTextDocumentStub.firstCall.args[0].scheme,
        VIEW_COLLECTION_SCHEME
      );
      assert(
        openTextDocumentStub.firstCall.args[0].query.includes(
          'namespace=testDbName.testColName'
        )
      );
    });

    test('mdb.addConnection command should call openWebview on the webview controller', async () => {
      const openWebviewStub = sandbox.stub(
        mdbTestExtension.testExtensionController._webviewController,
        'openWebview'
      );
      await vscode.commands.executeCommand('mdb.addConnection');
      assert.strictEqual(openWebviewStub.calledOnce, true);
    });

    test('mdb.addConnectionWithURI command should call connectWithURI on the connection controller', async () => {
      const fakeConnectWithURI = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'connectWithURI',
        fakeConnectWithURI
      );
      await vscode.commands.executeCommand('mdb.addConnectionWithURI');
      assert.strictEqual(fakeConnectWithURI.calledOnce, true);
    });

    test('mdb.refreshConnection command should reset the cache on a connection tree item', async () => {
      const testTreeItem = new ConnectionTreeItem(
        'test',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh
      );
      await vscode.commands.executeCommand(
        'mdb.refreshConnection',
        testTreeItem
      );
      assert.strictEqual(
        testTreeItem.cacheIsUpToDate,
        false,
        'Expected cache on tree item to be set to not up to date.'
      );
      assert.strictEqual(
        fakeRefresh.called,
        true,
        'Expected explorer controller refresh to be called.'
      );
    });

    test('mdb.treeItemRemoveConnection command should call removeMongoDBConnection on the connection controller with the tree item connection id', async () => {
      const testTreeItem = new ConnectionTreeItem(
        'craving_for_pancakes_with_maple_syrup',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      const fakeRemoveMongoDBConnection = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'removeMongoDBConnection',
        fakeRemoveMongoDBConnection
      );
      await vscode.commands.executeCommand(
        'mdb.treeItemRemoveConnection',
        testTreeItem
      );
      assert.strictEqual(fakeRemoveMongoDBConnection.calledOnce, true);
      assert.strictEqual(
        fakeRemoveMongoDBConnection.firstCall.args[0],
        'craving_for_pancakes_with_maple_syrup'
      );
    });

    test('mdb.copyConnectionString command should try to copy the driver url to the vscode env clipboard', async () => {
      const testTreeItem = new ConnectionTreeItem(
        'craving_for_pancakes_with_maple_syrup',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      const fakeCopyConnectionStringByConnectionId =
        sandbox.fake.returns('weStubThisUri');
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'copyConnectionStringByConnectionId',
        fakeCopyConnectionStringByConnectionId
      );
      await vscode.commands.executeCommand(
        'mdb.copyConnectionString',
        testTreeItem
      );
      assert.strictEqual(fakeWriteText.calledOnce, true);
      assert.strictEqual(fakeWriteText.firstCall.args[0], 'weStubThisUri');
    });

    test('mdb.copyDatabaseName command should try to copy the database name to the vscode env clipboard', async () => {
      const testTreeItem = new DatabaseTreeItem(
        'isClubMateTheBestDrinkEver',
        {},
        false,
        false,
        {}
      );
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      await vscode.commands.executeCommand(
        'mdb.copyDatabaseName',
        testTreeItem
      );
      assert.strictEqual(fakeWriteText.calledOnce, true);
      assert.strictEqual(
        fakeWriteText.firstCall.args[0],
        'isClubMateTheBestDrinkEver'
      );
    });

    test('mdb.copyCollectionName command should try to copy the collection name to the vscode env clipboard', async () => {
      const testTreeItem = new CollectionTreeItem(
        {
          name: 'waterBuffalo',
          type: CollectionTypes.collection,
        },
        'airZebra',
        {},
        false,
        false,
        null
      );
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      await vscode.commands.executeCommand(
        'mdb.copyCollectionName',
        testTreeItem
      );
      assert(
        fakeWriteText.called,
        'Expected "writeText" to be called on "vscode.env.clipboard".'
      );
      assert(
        fakeWriteText.firstCall.args[0] === 'waterBuffalo',
        `Expected the clipboard to be sent the uri string "waterBuffalo", found ${fakeWriteText.firstCall.args[0]}.`
      );
    });

    test('mdb.copySchemaFieldName command should try to copy the field name to the vscode env clipboard', async () => {
      const testTreeItem = new FieldTreeItem(
        {
          name: 'dolphins are sentient',
          probability: 1,
          type: 'String',
          types: [],
        },
        false,
        {}
      );
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      const commandResult = await vscode.commands.executeCommand(
        'mdb.copySchemaFieldName',
        testTreeItem
      );
      assert(commandResult);
      assert(
        fakeWriteText.called,
        'Expected "writeText" to be called on "vscode.env.clipboard".'
      );
      assert(
        fakeWriteText.firstCall.args[0] === 'dolphins are sentient',
        `Expected the clipboard to be sent the schema field name "dolphins are sentient", found ${fakeWriteText.firstCall.args[0]}.`
      );
    });

    test('mdb.refreshDatabase command should reset the cache on the database tree item', async () => {
      const testTreeItem = new DatabaseTreeItem(
        'pinkLemonade',
        {},
        false,
        false,
        {}
      );
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh
      );
      await vscode.commands.executeCommand('mdb.refreshDatabase', testTreeItem);
      assert.strictEqual(
        testTreeItem.cacheIsUpToDate,
        false,
        'Expected cache on tree item to be set to not up to date.'
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    });

    test('mdb.refreshCollection command should reset the expanded state of its children and call to refresh the explorer controller', async () => {
      const testTreeItem = new CollectionTreeItem(
        {
          name: 'iSawACatThatLookedLikeALionToday',
          type: CollectionTypes.collection,
        },
        'airZebra',
        {},
        false,
        false,
        null
      );
      testTreeItem.isExpanded = true;

      // Set expanded.
      testTreeItem.getSchemaChild().isExpanded = true;
      testTreeItem.getDocumentListChild().isExpanded = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh
      );
      await vscode.commands.executeCommand(
        'mdb.refreshCollection',
        testTreeItem
      );
      assert(
        testTreeItem.getSchemaChild().isExpanded === false,
        'Expected collection tree item child to be reset to not expanded.'
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    });

    test('mdb.refreshDocumentList command should update the document count and call to refresh the explorer controller', async () => {
      let count = 9000;
      const testTreeItem = new CollectionTreeItem(
        {
          name: 'iSawACatThatLookedLikeALionToday',
          type: CollectionTypes.collection,
        },
        'airZebra',
        { estimatedCount: () => Promise.resolve(count) },
        false,
        false,
        null
      );
      await testTreeItem.onDidExpand();

      const collectionChildren = await testTreeItem.getChildren();
      const docListTreeItem = collectionChildren[0];
      assert.strictEqual(docListTreeItem.description, '9K');
      count = 10000;
      docListTreeItem.isExpanded = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh
      );

      await vscode.commands.executeCommand(
        'mdb.refreshDocumentList',
        docListTreeItem
      );
      assert(
        docListTreeItem.cacheIsUpToDate === false,
        'Expected document list cache to be out of date.'
      );
      assert(
        testTreeItem.documentCount === 10000,
        `Expected document count to be 10000, found ${testTreeItem.documentCount}.`
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    });

    test('mdb.refreshSchema command should reset its cache and call to refresh the explorer controller', async () => {
      const testTreeItem = new SchemaTreeItem(
        'zebraWearwolf',
        'giraffeVampire',
        {} as DataService,
        false,
        false,
        false,
        false,
        {}
      );

      // Set cached.
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh
      );
      await vscode.commands.executeCommand('mdb.refreshSchema', testTreeItem);
      assert(
        !testTreeItem.cacheIsUpToDate,
        'Expected schema field cache to be not up to date.'
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    });

    test('mdb.refreshIndexes command should reset its cache and call to refresh the explorer controller', async () => {
      const testTreeItem = new IndexListTreeItem(
        'zebraWearwolf',
        'giraffeVampire',
        {} as DataService,
        false,
        false,
        []
      );

      // Set cached.
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh
      );
      await vscode.commands.executeCommand('mdb.refreshIndexes', testTreeItem);
      assert(
        !testTreeItem.cacheIsUpToDate,
        'Expected schema field cache to be not up to date.'
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    });

    test('mdb.addDatabase should create a MongoDB playground with create collection template', async () => {
      const testTreeItem = new ConnectionTreeItem(
        'tasty_sandwhich',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      await vscode.commands.executeCommand('mdb.addDatabase', testTreeItem);

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert(content.includes('// Create a new database.'));
      assert(content.includes('NEW_DATABASE_NAME'));
      assert(content.includes('NEW_COLLECTION_NAME'));
    });

    test('mdb.addCollection should create a MongoDB playground with create collection template', async () => {
      const testTreeItem = new DatabaseTreeItem(
        'iceCreamDB',
        {},
        false,
        false,
        {}
      );
      await vscode.commands.executeCommand('mdb.addCollection', testTreeItem);

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert(content.includes('// The current database to use.'));
      assert(content.includes('iceCreamDB'));
      assert(content.includes('NEW_COLLECTION_NAME'));
      assert(!content.includes('time-series'));
    });

    test('mdb.searchForDocuments should create a MongoDB playground with search template', async () => {
      await vscode.commands.executeCommand('mdb.searchForDocuments', {
        databaseName: 'dbbbbbName',
        collectionName: 'colllllllllName',
      });

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert(
        content.includes('Search for documents in the current collection.')
      );
      assert(content.includes('dbbbbbName'));
      assert(content.includes('colllllllllName'));
    });

    test('mdb.createIndexFromTreeView should create a MongoDB playground with index template', async () => {
      await vscode.commands.executeCommand('mdb.createIndexFromTreeView', {
        databaseName: 'dbbbbbName',
        collectionName: 'colllllllllName',
      });

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert(content.includes('Create a new index in the collection.'));
      assert(content.includes('dbbbbbName'));
      assert(content.includes('colllllllllName'));
    });

    test('mdb.createPlayground should create a MongoDB playground with default template', async () => {
      const fakeGetConfiguration = sandbox.fake.returns({
        get: () => true,
      });
      sandbox.replace(
        vscode.workspace,
        'getConfiguration',
        fakeGetConfiguration
      );
      await vscode.commands.executeCommand('mdb.createPlayground');

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert(content.includes('// MongoDB Playground'));
    });

    test('mdb.createPlayground command should create a MongoDB playground without template', async () => {
      const fakeGetConfiguration = sandbox.fake.returns({
        get: () => false,
      });
      sandbox.replace(
        vscode.workspace,
        'getConfiguration',
        fakeGetConfiguration
      );
      await vscode.commands.executeCommand('mdb.createPlayground');

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert.strictEqual(content, '');
    });

    test('mdb.addDatabase command fails when disconnecting', async () => {
      const testTreeItem = new ConnectionTreeItem(
        'tasty_sandwhich',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('theDbName');
      inputBoxResolvesStub.onCall(1).resolves('theCollectionName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const fakeIsDisconnecting = sandbox.fake.returns(true);
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'isDisconnecting',
        fakeIsDisconnecting
      );

      const addDatabaseSucceeded = await vscode.commands.executeCommand(
        'mdb.addDatabase',
        testTreeItem
      );
      assert(
        addDatabaseSucceeded === false,
        'Expected the add database command handler to return a false succeeded response'
      );

      const expectedMessage =
        'Unable to add database: currently disconnecting.';
      assert(
        showErrorMessageStub.firstCall.args[0] === expectedMessage,
        `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${showErrorMessageStub.firstCall.args[0]}"`
      );
    });

    test('mdb.addDatabase command fails when connecting', async () => {
      const testTreeItem = new ConnectionTreeItem(
        'tasty_sandwhich',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('theDbName');
      inputBoxResolvesStub.onCall(1).resolves('theCollectionName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const fakeIsConnecting = sandbox.fake.returns(true);
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'isConnecting',
        fakeIsConnecting
      );

      const addDatabaseSucceeded = await vscode.commands.executeCommand(
        'mdb.addDatabase',
        testTreeItem
      );
      assert(
        addDatabaseSucceeded === false,
        'Expected the add database command handler to return a false succeeded response'
      );

      const expectedMessage = 'Unable to add database: currently connecting.';
      assert(
        showErrorMessageStub.firstCall.args[0] === expectedMessage,
        `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${showErrorMessageStub.firstCall.args[0]}"`
      );
    });

    test('mdb.addCollection command fails when disconnecting', async () => {
      const testTreeItem = new DatabaseTreeItem(
        'iceCreamDB',
        {},
        false,
        false,
        {}
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('mintChocolateChips');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const fakeIsDisconnecting = sandbox.fake.returns(true);
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'isDisconnecting',
        fakeIsDisconnecting
      );

      const addCollectionSucceeded = await vscode.commands.executeCommand(
        'mdb.addCollection',
        testTreeItem
      );
      assert(
        addCollectionSucceeded === false,
        'Expected the add collection command handler to return a false succeeded response'
      );
      const expectedMessage =
        'Unable to add collection: currently disconnecting.';
      assert(
        showErrorMessageStub.firstCall.args[0] === expectedMessage,
        `Expected "${expectedMessage}" when adding a database to a not connected connection, recieved "${showErrorMessageStub.firstCall.args[0]}"`
      );
    });

    // https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups
    test('mdb.dropCollection calls data service to drop the collection after inputting the collection name', async () => {
      let calledNamespace = '';
      const testCollectionTreeItem = new CollectionTreeItem(
        { name: 'testColName', type: CollectionTypes.collection },
        'testDbName',
        {
          dropCollection: (namespace, callback): void => {
            calledNamespace = namespace;
            callback(null, true);
          },
        },
        false,
        false,
        null
      );

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('testColName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem
      );
      assert(successfullyDropped);
      assert.strictEqual(calledNamespace, 'testDbName.testColName');
    });

    test('mdb.dropCollection fails when a collection doesnt exist', async () => {
      const testConnectionController =
        mdbTestExtension.testExtensionController._connectionController;
      await testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI
      );

      const testCollectionTreeItem = new CollectionTreeItem(
        { name: 'doesntExistColName', type: CollectionTypes.collection },
        'doesntExistDBName',
        testConnectionController.getActiveDataService(),
        false,
        false,
        null
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('doesntExistColName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem
      );
      assert(
        successfullyDropped === false,
        'Expected the drop collection command handler to return a false succeeded response'
      );

      const expectedMessage = 'Drop collection failed: ns not found';
      assert(
        showErrorMessageStub.firstCall.args[0] === expectedMessage,
        `Expected "${expectedMessage}" when dropping a collection that doesn't exist, recieved "${showErrorMessageStub.firstCall.args[0]}"`
      );
      await testConnectionController.disconnect();
      testConnectionController.clearAllConnections();
    });

    test('mdb.dropCollection fails when the input doesnt match the collection name', async () => {
      const testCollectionTreeItem = new CollectionTreeItem(
        { name: 'orange', type: CollectionTypes.collection },
        'fruitsThatAreTasty',
        {},
        false,
        false,
        null
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('apple');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem
      );
      assert(
        successfullyDropped === false,
        'Expected the drop collection command handler to return a false succeeded response'
      );
    });

    test('mdb.dropCollection fails when the collection name input is empty', async () => {
      const testCollectionTreeItem = new CollectionTreeItem(
        { name: 'orange', type: CollectionTypes.view },
        'fruitsThatAreTasty',
        {},
        false,
        false,
        null
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves(/* Return undefined. */);
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem
      );
      assert(
        successfullyDropped === false,
        'Expected the drop collection command handler to return a false succeeded response'
      );
    });

    test('mdb.dropDatabase calls dataservice to drop the database after inputting the database name', async () => {
      let calledDatabaseName = '';
      const testDatabaseTreeItem = new DatabaseTreeItem(
        'iMissTangerineAltoids',
        {
          dropDatabase: (dbName, callback): void => {
            calledDatabaseName = dbName;
            callback(null, true);
          },
        },
        false,
        false,
        {}
      );

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('iMissTangerineAltoids');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem
      );
      assert.strictEqual(successfullyDropped, true);
      assert.strictEqual(calledDatabaseName, 'iMissTangerineAltoids');
    });

    test('mdb.dropDatabase succeeds even when a database doesnt exist (mdb behavior)', async () => {
      const testConnectionController =
        mdbTestExtension.testExtensionController._connectionController;
      await testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI
      );

      const testDatabaseTreeItem = new DatabaseTreeItem(
        'narnia____a',
        testConnectionController.getActiveDataService(),
        false,
        false,
        {}
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('narnia____a');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem
      );
      assert(
        successfullyDropped,
        'Expected the drop database command handler to return a successful boolean response'
      );
      assert(
        showErrorMessageStub.called === false,
        'Expected no error messages'
      );
    });

    test('mdb.dropDatabase fails when the input doesnt match the database name', async () => {
      const testDatabaseTreeItem = new DatabaseTreeItem(
        'cinnamonToastCrunch',
        {},
        false,
        false,
        {}
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('apple');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem
      );
      assert(
        successfullyDropped === false,
        'Expected the drop database command handler to return a false succeeded response'
      );
    });

    test('mdb.dropDatabase fails when the database name input is empty', async () => {
      const testDatabaseTreeItem = new DatabaseTreeItem(
        'blueBerryPancakesAndTheSmellOfBacon',
        {},
        false,
        false,
        {}
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves(/* Return undefined. */);
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem
      );
      assert(
        successfullyDropped === false,
        'Expected the drop database command handler to return a false succeeded response'
      );
    });

    test('mdb.renameConnection fails when the name input is empty', async () => {
      mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon =
        {
          id: 'blueBerryPancakesAndTheSmellOfBacon',
          connectionOptions: { connectionString: 'mongodb://localhost' },
          name: 'NAAAME',
          storageLocation: StorageLocation.NONE,
        };

      const testTreeItem = new ConnectionTreeItem(
        'blueBerryPancakesAndTheSmellOfBacon',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves(/* Return undefined. */);
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyRenamed = await vscode.commands.executeCommand(
        'mdb.renameConnection',
        testTreeItem
      );
      assert(
        successfullyRenamed === false,
        'Expected the rename connection command handler to return a false succeeded response'
      );
      assert(
        mdbTestExtension.testExtensionController._connectionController
          ._connections.blueBerryPancakesAndTheSmellOfBacon.name === 'NAAAME',
        'Expected connection not to be ranamed.'
      );
      mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    });

    test('mdb.renameConnection updates the name of a connection', async () => {
      mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon =
        {
          id: 'blueBerryPancakesAndTheSmellOfBacon',
          name: 'NAAAME',
          connectionOptions: { connectionString: 'mongodb://localhost' },
          storageLocation: StorageLocation.NONE,
        };

      const testTreeItem = new ConnectionTreeItem(
        'blueBerryPancakesAndTheSmellOfBacon',
        vscode.TreeItemCollapsibleState.None,
        false,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('orange juice');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyRenamed = await vscode.commands.executeCommand(
        'mdb.renameConnection',
        testTreeItem
      );
      assert.strictEqual(successfullyRenamed, true);
      assert.strictEqual(
        mdbTestExtension.testExtensionController._connectionController
          ._connections.blueBerryPancakesAndTheSmellOfBacon.name,
        'orange juice'
      );
      mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    });

    test('mdb.openMongoDBDocumentFromTree openes a document from the sidebar and saves it to MongoDB', async () => {
      const mockDocument = {
        _id: 'pancakes',
        name: '',
        time: {
          $time: '12345',
        },
      };
      const fakeGet = sandbox.fake.returns('pancakes');
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._documentIdStore,
        'get',
        fakeGet
      );

      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse(
        [
          'VIEW_DOCUMENT_SCHEME:/',
          'waffle.house:pancakes.json?',
          'namespace=waffle.house&',
          'connectionId=tasty_sandwhich&',
          'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
          'source=treeview',
        ].join('')
      );
      activeTextEditor.document.getText = () => JSON.stringify(mockDocument);
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () => activeTextEditor
      );

      const fakeGetActiveDataService = sandbox.fake.returns({
        find: () => {
          return Promise.resolve([mockDocument]);
        },
        findOneAndReplace: (
          namespace: string,
          filter: Filter<Document>,
          replacement: Document,
          options: FindOneAndReplaceOptions,
          callback: (error: Error | null, result: object) => void
        ) => {
          mockDocument.name = 'something sweet';

          return callback(null, mockDocument);
        },
      });
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        fakeGetActiveDataService
      );

      const documentItem = new DocumentTreeItem(
        mockDocument,
        'waffle.house',
        0,
        {} as DataService,
        () => Promise.resolve()
      );
      await vscode.commands.executeCommand(
        'mdb.openMongoDBDocumentFromTree',
        documentItem
      );
      assert(openTextDocumentStub.firstCall.args[0].path.includes('.json'));
      assert.strictEqual(
        openTextDocumentStub.firstCall.args[0].scheme,
        'VIEW_DOCUMENT_SCHEME'
      );
      assert(
        openTextDocumentStub.firstCall.args[0].query.includes('documentId=')
      );
      assert(
        openTextDocumentStub.firstCall.args[0].query.includes('connectionId=')
      );
      assert(
        openTextDocumentStub.firstCall.args[0].query.includes('source=treeview')
      );
      assert(
        openTextDocumentStub.firstCall.args[0].query.includes(
          'namespace=waffle.house'
        )
      );
      await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
      assert.strictEqual(mockDocument.name, 'something sweet');
      assert.strictEqual(mockDocument.time.$time, '12345');

      const expectedMessage =
        "The document was saved successfully to 'waffle.house'";

      assert.strictEqual(
        showInformationMessageStub.firstCall.args[0],
        expectedMessage
      );
    });

    test('mdb.openMongoDBDocumentFromTree openes a document from a tree with a treeview source', async () => {
      const mockDocument = {
        _id: 'pancakes',
        name: '',
        time: {
          $time: '12345',
        },
      };
      const documentItem = new DocumentTreeItem(
        mockDocument,
        'waffle.house',
        0,
        {} as DataService,
        () => Promise.resolve()
      );
      const fakeFetchDocument = sandbox.fake.resolves(null);
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._mongoDBDocumentService,
        'fetchDocument',
        fakeFetchDocument
      );
      await vscode.commands.executeCommand(
        'mdb.openMongoDBDocumentFromTree',
        documentItem
      );
      assert.strictEqual(
        fakeFetchDocument.firstCall.args[0].source,
        'treeview'
      );
    });

    test('mdb.openMongoDBDocumentFromCodeLens openes a document from a playground results with a playground source', async () => {
      const documentItem = {
        source: 'playground',
        line: 1,
        documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        namespace: 'db.coll',
        connectionId: null,
      };
      const fakeFetchDocument = sandbox.fake.resolves(null);
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._mongoDBDocumentService,
        'fetchDocument',
        fakeFetchDocument
      );
      await vscode.commands.executeCommand(
        'mdb.openMongoDBDocumentFromCodeLens',
        documentItem
      );
      assert.strictEqual(
        fakeFetchDocument.firstCall.args[0].source,
        'playground'
      );
    });

    test('mdb.saveMongoDBDocument replaces a document with a treeview source', async () => {
      const mockDocument = {
        _id: 'pancakes',
        name: '',
        time: {
          $time: '12345',
        },
      };
      const fakeGet = sandbox.fake.returns('pancakes');
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._documentIdStore,
        'get',
        fakeGet
      );
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () =>
          ({
            document: {
              uri: {
                scheme: 'VIEW_DOCUMENT_SCHEME',
                query: [
                  'namespace=waffle.house',
                  'connectionId=tasty_sandwhich',
                  'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
                  'source=treeview',
                ].join('&'),
              },
              getText: () => JSON.stringify(mockDocument),
              save: () => {},
            },
          } as unknown as typeof vscode.window.activeTextEditor)
      );

      const fakeReplaceDocument = sandbox.fake.resolves(null);
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._mongoDBDocumentService,
        'replaceDocument',
        fakeReplaceDocument
      );
      await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
      assert.strictEqual(
        fakeReplaceDocument.firstCall.args[0].source,
        'treeview'
      );
    });

    test('mdb.saveMongoDBDocuments replaces a document with a playground source', async () => {
      const mockDocument = {
        _id: 'pancakes',
        name: '',
        time: {
          $time: '12345',
        },
      };
      const fakeGet = sandbox.fake.returns('pancakes');
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._documentIdStore,
        'get',
        fakeGet
      );
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () =>
          ({
            document: {
              uri: {
                scheme: 'VIEW_DOCUMENT_SCHEME',
                query: [
                  'namespace=waffle.house',
                  'connectionId=tasty_sandwhich',
                  'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
                  'source=playground',
                ].join('&'),
              },
              getText: () => JSON.stringify(mockDocument),
              save: () => {},
            },
          } as unknown as typeof vscode.window.activeTextEditor)
      );

      const fakeReplaceDocument = sandbox.fake.resolves(null);
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._mongoDBDocumentService,
        'replaceDocument',
        fakeReplaceDocument
      );
      await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
      assert.strictEqual(
        fakeReplaceDocument.firstCall.args[0].source,
        'playground'
      );
    });

    test('mdb.runSelectedPlaygroundBlocks runs selected playgroundB blocks once', async () => {
      const fakeRunSelectedPlaygroundBlocks = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'runSelectedPlaygroundBlocks',
        fakeRunSelectedPlaygroundBlocks
      );
      await vscode.commands.executeCommand('mdb.runSelectedPlaygroundBlocks');
      assert(
        fakeRunSelectedPlaygroundBlocks.calledOnce,
        'Expected "runSelectedPlaygroundBlocks" to be called on the playground controller.'
      );
    });

    test('mdb.runAllPlaygroundBlocks runs all playgroundB blocks once', async () => {
      const fakeRunAllPlaygroundBlocks = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'runAllPlaygroundBlocks',
        fakeRunAllPlaygroundBlocks
      );
      await vscode.commands.executeCommand('mdb.runAllPlaygroundBlocks');
      assert(
        fakeRunAllPlaygroundBlocks.calledOnce,
        'Expected "runAllPlaygroundBlocks" to be called on the playground controller.'
      );
    });

    test('mdb.changeActiveConnection changes the active connection once', async () => {
      const fakeChangeActiveConnection = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'changeActiveConnection',
        fakeChangeActiveConnection
      );
      await vscode.commands.executeCommand('mdb.changeActiveConnection');
      assert(
        fakeChangeActiveConnection.calledOnce,
        'Expected "changeActiveConnection" to be called on the playground controller.'
      );
    });

    test('mdb.refreshPlaygroundsFromTreeView refreshes the playgrounds explorer once', async () => {
      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundsExplorer,
        'refresh',
        fakeRefresh
      );
      await vscode.commands.executeCommand(
        'mdb.refreshPlaygroundsFromTreeView'
      );
      assert(
        fakeRefresh.calledOnce,
        'Expected "refreshPlaygrounds" to be called on the playground controller.'
      );
    });

    test("mdb.copyDocumentContentsFromTreeView should copy a document's content to the clipboard", async () => {
      const mockDocument = {
        _id: 'pancakes',
        time: {
          $time: '12345',
        },
      };
      let namespaceUsed = '';

      const findStub = sandbox.stub();
      findStub.resolves([mockDocument]);

      const dataServiceStub = {
        find: (namespace: string) => {
          namespaceUsed = namespace;
          return Promise.resolve([mockDocument]);
        },
      } as Pick<DataService, 'find'> as unknown as DataService;
      const documentTreeItem = new DocumentTreeItem(
        mockDocument,
        'waffle.house',
        0,
        dataServiceStub,
        () => Promise.resolve()
      );
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      await vscode.commands.executeCommand(
        'mdb.copyDocumentContentsFromTreeView',
        documentTreeItem
      );
      assert.strictEqual(fakeWriteText.called, true);
      assert.strictEqual(
        fakeWriteText.firstCall.args[0],
        `{
  "_id": "pancakes",
  "time": {
    "$time": "12345"
  }
}`
      );
      assert.strictEqual(namespaceUsed, 'waffle.house');
    });

    test("mdb.cloneDocumentFromTreeView opens a playground with a document's content", async () => {
      const mockDocument = {
        _id: 'pancakes',
        time: new Date('3001-01-01T05:00:00.000Z'),
        objectIdField: new ObjectId('57e193d7a9cc81b4027498b2'),
      };
      let namespaceUsed = '';
      const dataServiceStub = {
        find: (namespace: string) => {
          namespaceUsed = namespace;
          return Promise.resolve([mockDocument]);
        },
      } as unknown as DataService;
      const documentTreeItem = new DocumentTreeItem(
        mockDocument,
        'waffle.house',
        0,
        dataServiceStub,
        () => Promise.resolve()
      );
      const fakeCreatePlaygroundForCloneDocument = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'createPlaygroundForCloneDocument',
        fakeCreatePlaygroundForCloneDocument
      );
      await vscode.commands.executeCommand(
        'mdb.cloneDocumentFromTreeView',
        documentTreeItem
      );
      assert.strictEqual(fakeCreatePlaygroundForCloneDocument.calledOnce, true);
      assert.strictEqual(
        fakeCreatePlaygroundForCloneDocument.firstCall.args[0],
        `{
  _id: 'pancakes',
  time: ISODate('3001-01-01T05:00:00.000Z'),
  objectIdField: ObjectId('57e193d7a9cc81b4027498b2')
}`
      );
      assert.strictEqual(
        fakeCreatePlaygroundForCloneDocument.firstCall.args[1],
        'waffle'
      );
      assert.strictEqual(
        fakeCreatePlaygroundForCloneDocument.firstCall.args[2],
        'house'
      );
      assert.strictEqual(namespaceUsed, 'waffle.house');
    });

    test('mdb.insertDocumentFromTreeView opens a playground with an insert document template', async () => {
      const collectionTreeItem = new CollectionTreeItem(
        {
          name: 'pineapple',
          type: CollectionTypes.collection,
        },
        'plants',
        {},
        false,
        false,
        null
      );
      const fakeCreatePlaygroundForInsertDocument = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'createPlaygroundForInsertDocument',
        fakeCreatePlaygroundForInsertDocument
      );
      await vscode.commands.executeCommand(
        'mdb.insertDocumentFromTreeView',
        collectionTreeItem
      );
      assert.strictEqual(
        fakeCreatePlaygroundForInsertDocument.calledOnce,
        true
      );
      assert.strictEqual(
        fakeCreatePlaygroundForInsertDocument.firstCall.args[0],
        'plants'
      );
      assert.strictEqual(
        fakeCreatePlaygroundForInsertDocument.firstCall.args[1],
        'pineapple'
      );
    });

    test('mdb.deleteDocumentFromTreeView deletes a document when the confirmation is canceled', async () => {
      const mockDocument = {
        _id: 'pancakes',
        time: {
          $time: '12345',
        },
      };
      let calledDelete = false;
      const dataServiceStub = {
        deleteOne: (
          namespace: string,
          filter: Filter<Document>,
          options: DeleteOptions,
          callback: (
            error: Error | undefined,
            result: { deletedCount: number }
          ) => void
        ) => {
          calledDelete = true;
          callback(undefined, {
            deletedCount: 1,
          });
        },
      } as Pick<DataService, 'deleteOne'> as unknown as DataService;
      const documentTreeItem = new DocumentTreeItem(
        mockDocument,
        'waffle.house',
        0,
        dataServiceStub,
        () => Promise.resolve()
      );
      const result = await vscode.commands.executeCommand(
        'mdb.deleteDocumentFromTreeView',
        documentTreeItem
      );
      assert.strictEqual(result, false);
      assert.strictEqual(calledDelete, false);
    });

    test('mdb.deleteDocumentFromTreeView deletes a document after confirmation', async () => {
      showInformationMessageStub.resolves('Yes');

      const mockDocument = {
        _id: 'pancakes',
        time: {
          $time: '12345',
        },
      };
      let namespaceUsed = '';
      let _idUsed;
      const dataServiceStub = {
        deleteOne: (
          namespace: string,
          filter: Filter<Document>,
          options: DeleteOptions,
          callback: (
            error: Error | undefined,
            result: { deletedCount: number }
          ) => void
        ) => {
          _idUsed = filter;
          namespaceUsed = namespace;
          callback(undefined, {
            deletedCount: 1,
          });
        },
      } as Pick<DataService, 'deleteOne'> as unknown as DataService;
      const documentTreeItem = new DocumentTreeItem(
        mockDocument,
        'waffle.house',
        0,
        dataServiceStub,
        () => Promise.resolve()
      );
      const result = await vscode.commands.executeCommand(
        'mdb.deleteDocumentFromTreeView',
        documentTreeItem
      );
      assert.deepStrictEqual(_idUsed, {
        _id: 'pancakes',
      });
      assert.strictEqual(namespaceUsed, 'waffle.house');
      assert.strictEqual(result, true);
    });

    suite('with mock execute command', function () {
      let executeCommandStub: SinonStub;

      beforeEach(() => {
        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
      });

      suite(
        'when a user hasnt been shown the initial overview page yet and they have no connections saved',
        () => {
          let fakeUpdate: SinonSpy;

          beforeEach(() => {
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'get',
              sandbox.fake.returns(false)
            );
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'hasSavedConnections',
              sandbox.fake.returns(false)
            );

            fakeUpdate = sandbox.fake.resolves(undefined);
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'update',
              fakeUpdate
            );

            void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
          });

          test('they are shown the overview page', () => {
            assert(executeCommandStub.called);
            assert.strictEqual(
              executeCommandStub.firstCall.args[0],
              'mdb.openOverviewPage'
            );
            assert.strictEqual(
              executeCommandStub.firstCall.args[0],
              EXTENSION_COMMANDS.MDB_OPEN_OVERVIEW_PAGE
            );
          });

          test("it sets that they've been shown the overview page", () => {
            assert(fakeUpdate.called);
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW
            );
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW'
            );
            assert.strictEqual(fakeUpdate.firstCall.args[1], true);
          });
        }
      );

      suite(
        'when a user hasnt been shown the initial overview page yet and they have connections saved',
        () => {
          let fakeUpdate: SinonSpy;

          beforeEach(() => {
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'get',
              sandbox.fake.returns(undefined)
            );
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'hasSavedConnections',
              sandbox.fake.returns(true)
            );
            fakeUpdate = sandbox.fake.resolves(undefined);
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'update',
              fakeUpdate
            );

            void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
          });

          test('they are not shown the overview page', () => {
            assert(!executeCommandStub.called);
          });

          test("it sets that they've been shown the overview page", () => {
            assert(fakeUpdate.called);
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW
            );
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW'
            );
            assert.strictEqual(fakeUpdate.firstCall.args[1], true);
          });
        }
      );

      suite('when a user has been shown the initial overview page', () => {
        beforeEach(() => {
          sandbox.replace(
            mdbTestExtension.testExtensionController._storageController,
            'get',
            sandbox.fake.returns(true)
          );

          void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
        });

        test('they are not shown the overview page', () => {
          assert(!executeCommandStub.called);
        });
      });
    });
  });
});
